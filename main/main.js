const { app, BrowserWindow } = require("electron");
const path = require("path");
const net = require("net");
const http = require("http");
const fs = require("fs");
const crypto = require("crypto");
const { spawn } = require("child_process");

const isDev = !app.isPackaged;

// Authenticates main.js's own call to /api/internal/sync-push (see
// before-quit below) -- fresh per launch, never leaves this process family,
// so the running server can trust it came from its own Electron parent and
// not some other device on the LAN.
const internalSyncToken = crypto.randomBytes(24).toString("hex");

// Second launch (double-clicked shortcut, or the app already running)
// focuses the existing window instead of leaving a second, port-colliding
// instance stuck on a permanently blank window.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  return;
}

let mainWindow = null;
let serverProcess = null;
let PORT = process.env.PORT || null;

function getDatabasePath() {
  return path.join(app.getPath("userData"), "kindergarten.db");
}

function getSyncStatePath() {
  return path.join(app.getPath("userData"), "sync-state.json");
}

// Plain JSON, deliberately not read via Prisma/the Setting table: this runs
// before the server (and its db connection) exists, and must survive the db
// file itself being replaced wholesale by a pull. Mirrors the read side of
// src/lib/sync-state.ts -- kept as a small standalone copy since main.js is
// plain CommonJS and can't import that TS module directly.
function readSyncStatePlain() {
  try {
    return JSON.parse(fs.readFileSync(getSyncStatePath(), "utf-8"));
  } catch {
    return {};
  }
}

function writeSyncStatePlain(patch) {
  const next = { ...readSyncStatePlain(), ...patch };
  fs.writeFileSync(getSyncStatePath(), JSON.stringify(next, null, 2));
}

/**
 * Runs before startServer() -- nothing has the db file open yet, which is
 * what makes overwriting it here safe. Doing this instead once the server
 * (and its live Prisma connection) is already up would risk the connection
 * keeping a handle on the old (now-unlinked) file while the visible path
 * points at new data -- silently stale reads on Linux, a locked-file error
 * on Windows. Best-effort and bounded: offline-first means this must never
 * block startup.
 */
async function pullDatabaseIfConfigured() {
  const state = readSyncStatePlain();
  if (!state.workerUrl || !state.token) return;

  try {
    const res = await fetch(state.workerUrl, {
      headers: { Authorization: `Bearer ${state.token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 404) return; // no device has pushed yet
    if (!res.ok) throw new Error(`pull failed: ${res.status}`);

    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(getDatabasePath(), buf);
    writeSyncStatePlain({ lastEtag: res.headers.get("etag") ?? "" });
    console.log("[sync] pulled latest database from remote");
  } catch (err) {
    console.error("[sync] pull skipped:", err.message);
  }
}

// Delegates the actual push to the running server (see
// src/app/api/internal/sync-push/route.ts) rather than touching Prisma from
// this process -- keeps main.js free of npm dependencies that electron-
// builder's packaging config doesn't already know to bundle.
async function pushDatabaseBeforeQuit() {
  const state = readSyncStatePlain();
  if (!state.workerUrl || !state.token || !PORT) return;

  try {
    const res = await fetch(`http://localhost:${PORT}/api/internal/sync-push`, {
      method: "POST",
      headers: { Authorization: `Bearer ${internalSyncToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) console.error("[sync] push responded", res.status);
  } catch (err) {
    console.error("[sync] push skipped:", err.message);
  }
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function fatalErrorHtml() {
  return `data:text/html;charset=utf-8,${encodeURIComponent(
    '<body style="font-family:sans-serif;direction:rtl;text-align:center;padding:60px"><h2>تعذر تشغيل الخادم الداخلي</h2><p>الرجاء إعادة تشغيل البرنامج. إذا استمرت المشكلة، تواصل مع الدعم الفني.</p></body>'
  )}`;
}

function startServer() {
  return new Promise((resolve, reject) => {
    if (isDev) {
      resolve();
      return;
    }

    const standaloneDir = path.join(process.resourcesPath, "standalone");
    const serverPath = path.join(standaloneDir, "server.js");

    serverProcess = spawn(process.execPath, [serverPath], {
      // Without this, spawning the Electron binary tries to boot Electron
      // itself against server.js instead of running it as plain Node.
      // cwd anchors relative paths to a deterministic location regardless
      // of how Windows launches the .exe.
      cwd: standaloneDir,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        PORT: String(PORT),
        HOSTNAME: "127.0.0.1",
        NODE_ENV: "production",
        // Override whatever relative DATABASE_URL shipped in the bundled
        // .env -- the db must live somewhere guaranteed writable, not
        // inside the (possibly read-only, e.g. Program Files) install dir.
        DATABASE_URL: `file:${getDatabasePath()}`,
        // Logs/ and Backups/ must live next to the db for the same reason
        // -- see src/lib/logger.ts and src/app/actions/backup-actions.ts.
        KG_DATA_DIR: app.getPath("userData"),
        // Lets /api/internal/sync-push trust that a request actually came
        // from this Electron process, not another device on the LAN.
        INTERNAL_SYNC_TOKEN: internalSyncToken,
      },
      stdio: "pipe",
    });

    serverProcess.stdout.on("data", (data) => {
      console.log(`[server] ${data}`);
    });

    serverProcess.stderr.on("data", (data) => {
      console.error(`[server] ${data}`);
    });

    serverProcess.on("exit", (code) => {
      if (code !== null && code !== 0) {
        console.error(`[server] exited unexpectedly with code ${code}`);
      }
      serverProcess = null;
    });

    let attempts = 0;
    const maxAttempts = 40;

    const checkServer = () => {
      attempts++;
      const req = http.get(`http://localhost:${PORT}`, () => {
        resolve();
      });
      req.on("error", () => {
        if (attempts < maxAttempts) {
          setTimeout(checkServer, 500);
        } else {
          reject(new Error("Failed to start server after max attempts"));
        }
      });
      req.end();
    };

    setTimeout(checkServer, 1000);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    title: "إدارة الروضة",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.webContents.on("did-fail-load", () => {
    // Only the "server was up, then died mid-session" case reaches here --
    // a failure to start at all is caught where startServer() is awaited,
    // below. mainWindow may already be null (closed) or its webContents
    // torn down if the load fails as the user quits -- loadURL would then
    // throw in the main process. Guard before touching it.
    if (!serverProcess && !isDev && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(fatalErrorHtml());
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  if (!PORT) {
    PORT = isDev ? 3000 : await getFreePort();
  }

  // Skipped in dev: a developer's local test db shouldn't silently pull
  // shared production data, or (via before-quit, below) push test data
  // over it.
  if (!isDev) {
    await pullDatabaseIfConfigured();
  }

  try {
    await startServer();
    createWindow();
  } catch (err) {
    console.error(err);
    mainWindow = new BrowserWindow({ width: 700, height: 400, title: "إدارة الروضة" });
    mainWindow.loadURL(fatalErrorHtml());
  }
});

function killServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

let quitting = false;
app.on("before-quit", (event) => {
  if (quitting || isDev) return;
  event.preventDefault();
  quitting = true;
  pushDatabaseBeforeQuit().finally(() => {
    killServer();
    app.quit();
  });
});

// Backstop: covers isDev (no push) and the re-entrant app.quit() above,
// where before-quit is already done and killServer() just needs to run.
app.on("will-quit", killServer);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
