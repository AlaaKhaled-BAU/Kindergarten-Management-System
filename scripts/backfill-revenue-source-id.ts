/**
 * Do not re-run; superseded by migration backfill of Transaction.receiptId.
 *
 * One-off repair + backfill for revenue rows written before Revenue.sourceId
 * existed.
 *
 * processPayment writes the Revenue row inside the same transaction as the
 * Payment, so payment-source revenue rows and payments share a creation order.
 * They do NOT share ids -- a cancellation row and a manual row were inserted
 * part-way through, shifting every revenue id after them. An earlier repair
 * assumed revenue.id == payment.id and so wrote the wrong recordDate and
 * description onto the shifted rows.
 *
 * amount is the one field no repair ever touched, so aligning the two id-sorted
 * lists and requiring all 56 amounts to agree proves the mapping before any
 * write happens.
 *
 * Usage: npx tsx scripts/backfill-revenue-source-id.ts
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const payRevs = await prisma.revenue.findMany({
    where: { source: "Payment" },
    orderBy: { id: "asc" },
  });
  const payments = await prisma.payment.findMany({
    include: { student: true, receipts: true },
    orderBy: { id: "asc" },
  });

  if (payRevs.length !== payments.length) {
    throw new Error(
      `Refusing to write: ${payRevs.length} payment revenue rows vs ${payments.length} payments`,
    );
  }
  const mismatched = payRevs.filter((r, i) => r.amount !== payments[i].amount);
  if (mismatched.length > 0) {
    throw new Error(
      `Refusing to write: amounts disagree at ${mismatched.length} position(s): ` +
        mismatched.map((r) => `rev#${r.id}`).join(", "),
    );
  }

  let repaired = 0;
  for (const [i, revenue] of payRevs.entries()) {
    const payment = payments[i];
    const receipt = payment.receipts[0];
    const description = `دفعة من الطالب: ${payment.student.firstName} ${payment.student.lastName}`;
    const year = payment.paymentDate.getUTCFullYear();
    const month = payment.paymentDate.getUTCMonth() + 1;

    const alreadyCorrect =
      revenue.sourceId === (receipt?.id ?? null) &&
      revenue.description === description &&
      revenue.year === year &&
      revenue.month === month &&
      revenue.recordDate.toISOString() === payment.paymentDate.toISOString();
    if (alreadyCorrect) continue;

    await prisma.revenue.update({
      where: { id: revenue.id },
      data: {
        sourceId: receipt?.id ?? null,
        description,
        recordDate: payment.paymentDate,
        year,
        month,
      },
    });
    repaired++;
  }

  let cancelRepaired = 0;
  const canceled = await prisma.receipt.findMany({ where: { isCanceled: true } });
  for (const receipt of canceled) {
    const row = await prisma.revenue.findFirst({
      where: {
        source: "Cancellation",
        description: { contains: `إلغاء إيصال رقم ${receipt.receiptNumber}` },
      },
    });
    if (!row) continue;
    await prisma.revenue.update({
      where: { id: row.id },
      data: {
        sourceId: receipt.id,
        recordDate: receipt.issueDate,
        year: receipt.issueDate.getUTCFullYear(),
        month: receipt.issueDate.getUTCMonth() + 1,
      },
    });
    cancelRepaired++;
  }

  const stillUnlinked = await prisma.revenue.count({
    where: { source: { in: ["Payment", "Cancellation"] }, sourceId: null },
  });

  console.log(`Repaired/linked ${repaired} payment revenue row(s)`);
  console.log(`Repaired/linked ${cancelRepaired} cancellation revenue row(s)`);
  console.log(`Still unlinked: ${stillUnlinked}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
