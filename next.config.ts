import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client", ".prisma/client", "pg", "pg-cloudflare"],
  outputFileTracingIncludes: {
    "/*": [
      "./prisma/**/*",
      "./node_modules/.prisma/**/*",
      "./node_modules/pg-cloudflare/**/*",
    ],
  },
};

export default nextConfig;
