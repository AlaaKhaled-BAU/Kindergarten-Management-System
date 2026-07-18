export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureDatabaseReady } = await import("./src/lib/db-init");
    await ensureDatabaseReady();
  }
}
