const { spawn } = require("child_process");
const http = require("http");

const PORT = process.env.PORT || "3000";
const URL = `http://localhost:${PORT}`;
const MAX_ATTEMPTS = 120;
const RETRY_MS = 1000;

function waitForServer() {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      http
        .get(URL, (res) => {
          if (res.statusCode >= 200 && res.statusCode < 400) {
            res.resume();
            resolve();
          } else {
            res.resume();
            retry();
          }
        })
        .on("error", retry);

      function retry() {
        if (attempts >= MAX_ATTEMPTS) {
          reject(new Error(`Server not ready after ${MAX_ATTEMPTS}s`));
        } else {
          process.stdout.write(
            `\r⏳ Waiting for Next.js... ${attempts}/${MAX_ATTEMPTS}s`
          );
          setTimeout(check, RETRY_MS);
        }
      }
    };
    check();
  });
}

async function main() {
  console.log("🚀 Starting Next.js dev server...\n");

  const nextDev = spawn("npx", ["next", "dev", "-p", PORT], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, PORT },
  });

  try {
    await waitForServer();
    console.log("\n✅ Next.js ready, launching Electron...\n");

    const electron = spawn("npx", ["electron", "."], {
      stdio: "inherit",
      shell: true,
      env: { ...process.env, PORT, ELECTRON_ENABLE_LOGGING: "1" },
    });

    electron.on("close", (code) => {
      console.log(`\n🛑 Electron closed (code ${code})`);
      nextDev.kill();
      process.exit(code ?? 0);
    });

    process.on("SIGINT", () => {
      electron.kill();
      nextDev.kill();
      process.exit();
    });

    process.on("SIGTERM", () => {
      electron.kill();
      nextDev.kill();
      process.exit();
    });
  } catch (err) {
    console.error(`\n❌ ${err.message}`);
    nextDev.kill();
    process.exit(1);
  }
}

main();
