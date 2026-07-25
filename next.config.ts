import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/*": ["./prisma/**/*", "./node_modules/.prisma/**/*"],
  },
  outputFileTracingExcludes: {
    // Without these, `next build` bundles whatever happens to be on the
    // developer's disk at build time into .next/standalone -- the real
    // SQLite DB, real backups, real logs, and the plaintext .env -- because
    // the tracer resolves DATABASE_URL/Logs/Backups from process.cwd()
    // statically. All of it ends up shipped in the installer otherwise.
    // node_modules/@img (sharp, pulled in for next/image which this app
    // never uses) is excluded purely to shrink the bundle. .env is NOT
    // listed here -- Next always copies env files into standalone output
    // regardless of tracing excludes, so this file ships either way. That
    // used to matter (it held ADMIN_PASSWORD/KG_NAME); it's harmless now
    // that those live in the database instead, so the shipped .env only
    // ever contains the non-secret DATABASE_URL default.
    "**": [
      "./*.db",
      "./*.db-journal",
      "./Backups/**",
      "./Logs/**",
      "./node_modules/@img/**",
    ],
  },
};

export default nextConfig;
