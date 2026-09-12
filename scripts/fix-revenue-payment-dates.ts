/**
 * One-off repair: payment/cancellation revenue rows used recordDate = now()
 * instead of the actual payment/receipt date. Re-sync from Payment/Receipt.
 *
 * Usage: npx tsx scripts/fix-revenue-payment-dates.ts
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const payments = await prisma.payment.findMany({
    include: { student: true, receipts: true },
    orderBy: { id: "asc" },
  });

  let paymentFixed = 0;
  for (const payment of payments) {
    const revenue =
      (await prisma.revenue.findFirst({
        where: { id: payment.id, source: "Payment", isActive: true },
      })) ??
      (await prisma.revenue.findFirst({
        where: {
          source: "Payment",
          isActive: true,
          amount: payment.amount,
          year: payment.paymentDate.getFullYear(),
          month: payment.paymentDate.getMonth() + 1,
          description: { contains: payment.student.firstName },
        },
        orderBy: { id: "asc" },
      }));

    if (!revenue) {
      console.warn(`No revenue for payment ${payment.id} (${payment.student.firstName})`);
      continue;
    }

    const correctDescription = `دفعة من الطالب: ${payment.student.firstName} ${payment.student.lastName}`;
    const needsDate =
      revenue.recordDate.toISOString().slice(0, 10) !==
      payment.paymentDate.toISOString().slice(0, 10);
    const needsDescription = revenue.description !== correctDescription;

    if (needsDate || needsDescription) {
      await prisma.revenue.update({
        where: { id: revenue.id },
        data: {
          recordDate: payment.paymentDate,
          ...(needsDescription && { description: correctDescription }),
        },
      });
      paymentFixed++;
    }
  }

  const canceledReceipts = await prisma.receipt.findMany({
    where: { isCanceled: true },
    include: { payment: true },
  });

  let cancelFixed = 0;
  for (const receipt of canceledReceipts) {
    const revenue = await prisma.revenue.findFirst({
      where: {
        source: "Cancellation",
        isActive: true,
        amount: -receipt.amount,
        year: receipt.issueDate.getFullYear(),
        month: receipt.issueDate.getMonth() + 1,
        description: { contains: String(receipt.receiptNumber) },
      },
    });
    if (!revenue) continue;

    if (
      revenue.recordDate.toISOString().slice(0, 10) !==
      receipt.issueDate.toISOString().slice(0, 10)
    ) {
      await prisma.revenue.update({
        where: { id: revenue.id },
        data: { recordDate: receipt.issueDate },
      });
      cancelFixed++;
    }
  }

  console.log(`Updated ${paymentFixed} payment revenue row(s)`);
  console.log(`Updated ${cancelFixed} cancellation revenue row(s)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
