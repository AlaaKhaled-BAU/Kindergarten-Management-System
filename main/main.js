const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

const isDev = !app.isPackaged;
const PORT = process.env.PORT || "3000";

let mainWindow = null;
let serverProcess = null;

function getDatabasePath() {
  return path.join(app.getPath("userData"), "kindergarten.db");
}

function startServer() {
  return new Promise((resolve) => {
    if (isDev) {
      resolve();
      return;
    }

    const standaloneDir = path.join(process.resourcesPath, "standalone");
    const serverPath = path.join(standaloneDir, "server.js");

    serverProcess = spawn(process.execPath, [serverPath], {
      // Without this, spawning the Electron binary tries to boot Electron
      // itself against server.js instead of running it as plain Node.
      // cwd anchors relative paths (Logs/, Backups/, per AGENTS.md kept
      // next to the app, not hidden in userData) to a deterministic
      // location regardless of how Windows launches the .exe.
      cwd: standaloneDir,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        PORT,
        NODE_ENV: "production",
        // Override whatever relative DATABASE_URL shipped in the bundled
        // .env -- the db must live somewhere guaranteed writable, not
        // inside the (possibly read-only, e.g. Program Files) install dir.
        DATABASE_URL: `file:${getDatabasePath()}`,
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
    const maxAttempts = 30;

    const checkServer = () => {
      attempts++;
      const http = require("http");
      const req = http.get(`http://localhost:${PORT}`, () => {
        resolve();
      });
      req.on("error", () => {
        if (attempts < maxAttempts) {
          setTimeout(checkServer, 500);
        } else {
          console.error("Failed to start server after max attempts");
          resolve();
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
    // mainWindow may already be null (closed) or its webContents torn down if
    // the load fails as the user quits -- loadURL would then throw in the main
    // process. Guard before touching it.
    if (!serverProcess && !isDev && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(
          '<body style="font-family:sans-serif;direction:rtl;text-align:center;padding:60px"><h2>تعذر تشغيل الخادم الداخلي</h2><p>الرجاء إعادة تشغيل البرنامج. إذا استمرت المشكلة، تواصل مع الدعم الفني.</p></body>'
        )}`
      );
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await startServer();
  createWindow();
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});

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
