const fs = require("fs");
const path = require("path");

const textkitPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "@react-pdf",
  "textkit",
  "lib",
  "textkit.js"
);

if (!fs.existsSync(textkitPath)) {
  console.log("[patch] textkit.js not found, skipping.");
  process.exit(0);
}

let code = fs.readFileSync(textkitPath, "utf-8");

if (code.includes("/* PATCHED: reorderLine no-op */")) {
  console.log("[patch] Already patched, skipping.");
  process.exit(0);
}

const oldFn = `const reorderLine = (line) => {
    const levels = getBidiLevels$1(line.runs);
    const direction = line.runs[0]?.attributes.direction;
    const level = direction === 'rtl' ? 1 : 0;
    const end = length$1(line) - 1;
    const paragraphs = [{ start: 0, end, level }];
    const embeddingLevels = { paragraphs, levels };
    const segments = bidi$2.getReorderSegments(line.string, embeddingLevels);
    // No need for bidi reordering
    if (segments.length === 0)
        return line;
    const indices = getReorderedIndices(line.string, segments);
    const updatedString = bidi$2.getReorderedString(line.string, embeddingLevels);
    const updatedRuns = line.runs.map((run) => {
        const selectedIndices = indices.slice(run.start, run.end);
        const updatedGlyphs = [];
        const updatedPositions = [];
        const addedGlyphs = new Set();
        for (let i = 0; i < selectedIndices.length; i += 1) {
            const index = selectedIndices[i];
            const glyph = getItemAtIndex(line.runs, 'glyphs', index);
            if (addedGlyphs.has(glyph.id))
                continue;
            updatedGlyphs.push(glyph);
            updatedPositions.push(getItemAtIndex(line.runs, 'positions', index));
            if (glyph.isLigature) {
                addedGlyphs.add(glyph.id);
            }
        }
        return {
            ...run,
            glyphs: updatedGlyphs,
            positions: updatedPositions,
        };
    });
    return {
        box: line.box,
        runs: updatedRuns,
        string: updatedString,
    };
};`;

const newFn = `const reorderLine = (line) => {
    /* PATCHED: reorderLine no-op - prevents BIDI reorder crash with Arabic text */
    return line;
};`;

if (!code.includes(oldFn)) {
  console.error("[patch] FAILED - could not find exact reorderLine function text.");
  console.error("[patch] The textkit package may have been updated. Check manually.");
  process.exit(1);
}

code = code.replace(oldFn, newFn);

fs.writeFileSync(textkitPath, code, "utf-8");
console.log("[patch] Successfully patched reorderLine in textkit.js.");