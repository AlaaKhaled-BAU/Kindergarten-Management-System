-- 1) FK Revenue.sourceId -> Receipt.id (column already exists)
ALTER TABLE "Revenue"
  ADD CONSTRAINT "Revenue_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "Receipt"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 2) One Payment revenue and one Cancellation revenue per receipt
CREATE UNIQUE INDEX "Revenue_source_sourceId_key"
  ON "Revenue"("source", "sourceId");

-- 3) Ledger join
ALTER TABLE "Transaction" ADD COLUMN "receiptId" INTEGER;
CREATE INDEX "Transaction_receiptId_idx" ON "Transaction"("receiptId");
ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_receiptId_fkey"
  FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 4) Backfill ledger FK from the printed number already stored in referenceId
UPDATE "Transaction" t
SET "receiptId" = r.id
FROM "Receipt" r
WHERE t."referenceId" = 'Receipt:' || r."receiptNumber"::text
  AND t."receiptId" IS NULL;
