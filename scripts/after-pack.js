// electron-builder's extraResources copy silently drops most of a nested
// node_modules tree (a documented electron-builder limitation with scoped
// @-packages and its "production dependency" auto-detection getting
// confused by node_modules nested inside a copied folder rather than at
// the project root -- see electron-userland/electron-builder#4085). The
// packaged app ended up with only server.js + package.json under
// resources/standalone, missing node_modules/next entirely and crashing
// on first launch with "Cannot find module 'next'".
//
// Bypasses that logic with a plain recursive copy after electron-builder
// finishes packing, run instead of the (removed) extraResources entries.
// Shells out to `cp` rather than fs.cpSync -- cpSync threw ENOENT partway
// through this exact copy in electron-builder's afterPack context even
// though the identical call succeeded in isolation; cp is decades-old and
// unambiguous about recursive directory creation.
//
// -L dereferences symlinks (copies real file content, not the link) --
// Next's standalone output relies on relative symlinks like
// .next/node_modules/@prisma/client-<hash> -> ../../../node_modules/@prisma/client
// to stitch Turbopack's externalized-module cache back to the real
// package. Something later in electron-builder's own packaging pipeline
// rewrites those relative targets (observed: 3 levels became 7, pointing
// nowhere), so a preserved symlink breaks after packaging regardless of
// how faithfully this script itself copies it. Dereferencing removes the
// symlink -- and therefore anything downstream rewriting it -- entirely.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function copyInto(from, to) {
  fs.mkdirSync(to, { recursive: true });
  // Trailing "/." on the source copies its *contents* into an existing
  // destination dir, matching fs.cpSync's merge semantics instead of
  // nesting a copy of the source dir one level too deep.
  execFileSync("cp", ["-rL", `${from}/.`, to], { stdio: "inherit" });
}

module.exports = async function afterPack(context) {
  const projectRoot = path.join(__dirname, "..");
  const resourcesDir = path.join(context.appOutDir, "resources");
  const standaloneDir = path.join(resourcesDir, "standalone");

  copyInto(path.join(projectRoot, ".next", "standalone"), standaloneDir);
  copyInto(path.join(projectRoot, ".next", "static"), path.join(standaloneDir, ".next", "static"));
  copyInto(path.join(projectRoot, "public"), path.join(standaloneDir, "public"));

  const serverPath = path.join(standaloneDir, "server.js");
  const nextModulePath = path.join(standaloneDir, "node_modules", "next", "package.json");
  if (!fs.existsSync(serverPath) || !fs.existsSync(nextModulePath)) {
    throw new Error(
      `afterPack: standalone copy incomplete (server.js or node_modules/next missing under ${standaloneDir})`
    );
  }

  console.log(`[after-pack] copied standalone build into ${standaloneDir}`);
};
