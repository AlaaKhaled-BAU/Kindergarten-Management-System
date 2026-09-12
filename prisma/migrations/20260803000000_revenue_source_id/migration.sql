-- Payment/Cancellation revenue rows had no link back to the receipt that
-- produced them, so correcting a receipt could only find its revenue row by
-- guessing on amount + date + name. sourceId holds Receipt.id instead.
ALTER TABLE "Revenue" ADD COLUMN "sourceId" INTEGER;

CREATE INDEX "Revenue_source_sourceId_idx" ON "Revenue"("source", "sourceId");
