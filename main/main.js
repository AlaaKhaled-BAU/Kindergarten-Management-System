const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

const isDev = !app.isPackaged;
const PORT = process.env.PORT || "3000";

let mainWindow = null;
let serverProcess = null;

function startServer() {
  return new Promise((resolve) => {
    if (isDev) {
      resolve();
      return;
    }

    const serverPath = path.join(
      process.resourcesPath,
      "standalone",
      "server.js"
    );

    serverProcess = spawn(process.execPath, [serverPath], {
      env: { ...process.env, PORT, NODE_ENV: "production" },
      stdio: "pipe",
    });

    serverProcess.stdout.on("data", (data) => {
      console.log(`[server] ${data}`);
    });

    serverProcess.stderr.on("data", (data) => {
      console.error(`[server] ${data}`);
    });

    let attempts = 0;
    const maxAttempts = 30;

    const checkServer = () => {
      attempts++;
      const http = require("http");
      const req = http.get(`http://localhost:${PORT}`, (res) => {
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

  if (isDev) {
    mainWindow.loadURL(`http://localhost:${PORT}`);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadURL(`http://localhost:${PORT}`);
  }

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
