import { Font } from "@react-pdf/renderer";

// Shared, one-time registration of the print font for every PDF document.
// Import this module for its side effect (`import "./fonts"`) from each PDF
// component; Font.register is a global registry, so registering once here is
// enough and keeps the load-bearing explanation below in a single place.
//
// .ttf, not .woff2: fontkit's WOFF2 loca-table reconstruction produces
// corrupted glyph offsets for this font (confirmed via direct fontkit
// inspection -- glyph 1084's loca entries came back near the uint32 boundary,
// ~4.29 billion, vs fonttools' correctly-decoded ~50000), crashing
// subset.encode() on any Arabic text with "Offset is outside the bounds of the
// DataView". The browser's native woff2 decoder (used for the on-screen/print
// CSS @font-face in globals.css) is unaffected; only react-pdf's fontkit-based
// PDF font embedding needs the .ttf.
Font.register({
  family: "Scheherazade New",
  fonts: [
    { src: "/fonts/scheherazade-400.ttf", fontWeight: 400 },
    { src: "/fonts/scheherazade-700.ttf", fontWeight: 700 },
  ],
});
