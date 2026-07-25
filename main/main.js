const { app, BrowserWindow } = require("electron");
const path = require("path");
const net = require("net");
const http = require("http");
const { spawn } = require("child_process");

const isDev = !app.isPackaged;

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
        NODE_ENV: "production",
        // Override whatever relative DATABASE_URL shipped in the bundled
        // .env -- the db must live somewhere guaranteed writable, not
        // inside the (possibly read-only, e.g. Program Files) install dir.
        DATABASE_URL: `file:${getDatabasePath()}`,
        // Logs/ and Backups/ must live next to the db for the same reason
        // -- see src/lib/logger.ts and src/app/actions/backup-actions.ts.
        KG_DATA_DIR: app.getPath("userData"),
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

app.on("before-quit", killServer);
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
