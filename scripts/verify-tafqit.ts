// ponytail: standalone assert-based sanity check for tafqit.ts (money-in-words
// printed on every receipt). No test framework in this repo yet — run directly:
//   npx tsx scripts/verify-tafqit.ts
import assert from "node:assert";
import { numberToArabicWords, formatDinarAmount } from "../src/lib/tafqit";

const cases: [number, string][] = [
  [0, "صفر"],
  [1, "دينار أردني"],
  [2, "ديناران أردنيان"],
  [3, "ثلاثة دنانير أردنية"],
  [10, "عشرة دنانير أردنية"],
  [11, "أحد عشر ديناراً أردنياً"],
  [100, "مائة دينار أردني"],
  [500.05, "خمسمائة دينار أردني و خمسون فلساً"],
  [1000, "ألف دينار أردني"],
  [1234.5, "ألف و مئتان و أربعة و ثلاثون ديناراً أردنياً و خمسمائة فلس"],
  [500.005, "خمسمائة دينار أردني و خمسة فلوس"],
  [1.9995, "ديناران أردنيان"], // fils rounds to 1000 -> carries into dinars
];

for (const [amount, expected] of cases) {
  const actual = numberToArabicWords(amount);
  assert.strictEqual(actual, expected, `numberToArabicWords(${amount}): got "${actual}", expected "${expected}"`);
}

assert.strictEqual(numberToArabicWords(-50), "سالب خمسون ديناراً أردنياً");
assert.strictEqual(formatDinarAmount(500.05), "500 دينار و 50 فلس");
assert.strictEqual(formatDinarAmount(500), "500 دينار");

console.log(`OK: ${cases.length + 3} tafqit cases passed.`);
