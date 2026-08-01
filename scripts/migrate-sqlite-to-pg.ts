import { DatabaseSync } from "node:sqlite";
import { PrismaClient } from "@prisma/client";

const SQLITE_PATH = process.env.SQLITE_PATH ?? `${process.env.HOME}/.config/kindergarten-erp/kindergarten.db`;
const prisma = new PrismaClient();

const DATE_COLUMNS = new Set([
  "dateOfBirth",
  "enrollmentDate",
  "paymentDate",
  "issueDate",
  "cancelDate",
  "refundDate",
  "transactionDate",
  "createdAt",
  "recordDate",
  "expenseDate",
  "dueDate",
]);

const BOOL_COLUMNS = new Set(["isActive", "discountIsPercent", "isCanceled"]);

function convertRow(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v !== null && DATE_COLUMNS.has(k)) {
      out[k] = new Date(Number(v));
    } else if (v !== null && BOOL_COLUMNS.has(k)) {
      out[k] = Boolean(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function main() {
  const sqlite = new DatabaseSync(SQLITE_PATH);
  console.log(`قراءة من: ${SQLITE_PATH}`);

  const settings = sqlite.prepare(`SELECT key, value FROM Setting`).all() as Array<{ key: string; value: string }>;
  const fees = sqlite.prepare(`SELECT * FROM Fee`).all() as Array<Record<string, unknown>>;
  const students = sqlite.prepare(`SELECT * FROM Student ORDER BY id`).all() as Array<Record<string, unknown>>;
  const transactions = sqlite.prepare(`SELECT * FROM "Transaction" ORDER BY id`).all() as Array<Record<string, unknown>>;
  const parents = sqlite.prepare(`SELECT * FROM Parent`).all() as Array<Record<string, unknown>>;
  const studentParents = sqlite.prepare(`SELECT * FROM StudentParent`).all() as Array<Record<string, unknown>>;
  const pickups = sqlite.prepare(`SELECT * FROM AuthorizedPickupPerson`).all() as Array<Record<string, unknown>>;
  const studentFees = sqlite.prepare(`SELECT * FROM StudentFee`).all() as Array<Record<string, unknown>>;
  const payments = sqlite.prepare(`SELECT * FROM Payment`).all() as Array<Record<string, unknown>>;
  const receipts = sqlite.prepare(`SELECT * FROM Receipt`).all() as Array<Record<string, unknown>>;
  const revenues = sqlite.prepare(`SELECT * FROM Revenue`).all() as Array<Record<string, unknown>>;
  const expenses = sqlite.prepare(`SELECT * FROM Expense`).all() as Array<Record<string, unknown>>;
  const refunds = sqlite.prepare(`SELECT * FROM Refund`).all() as Array<Record<string, unknown>>;
  sqlite.close();

  console.log(`البيانات: settings=${settings.length} fees=${fees.length} students=${students.length} transactions=${transactions.length} payments=${payments.length} receipts=${receipts.length} revenues=${revenues.length} expenses=${expenses.length} refunds=${refunds.length}`);

  const studentIdMap = new Map<number, number>();
  const paymentIdMap = new Map<number, number>();
  const feeIdMap = new Map<number, number>();
  const parentIdMap = new Map<number, number>();

  await prisma.$transaction(async (tx) => {
    for (const s of settings) {
      await tx.setting.upsert({ where: { key: s.key }, update: { value: s.value }, create: { key: s.key, value: s.value } });
    }

    for (const f of fees) {
      const created = await tx.fee.create({ data: convertRow(f) as never });
      feeIdMap.set(Number(f.id), created.id);
    }

    for (const s of students) {
      const created = await tx.student.create({ data: convertRow(s) as never });
      studentIdMap.set(Number(s.id), created.id);
    }

    for (const t of transactions) {
      const row = convertRow(t);
      await tx.transaction.create({ data: { ...row, studentId: studentIdMap.get(Number(t.studentId))! } as never });
    }

    for (const p of parents) {
      const created = await tx.parent.create({ data: convertRow(p) as never });
      parentIdMap.set(Number(p.id), created.id);
    }

    for (const sp of studentParents) {
      await tx.studentParent.create({ data: { studentId: studentIdMap.get(Number(sp.studentId))!, parentId: parentIdMap.get(Number(sp.parentId))! } });
    }

    for (const pk of pickups) {
      await tx.authorizedPickupPerson.create({ data: { ...convertRow(pk), studentId: studentIdMap.get(Number(pk.studentId))! } as never });
    }

    for (const sf of studentFees) {
      await tx.studentFee.create({ data: { studentId: studentIdMap.get(Number(sf.studentId))!, feeId: feeIdMap.get(Number(sf.feeId))! } });
    }

    for (const p of payments) {
      const created = await tx.payment.create({ data: convertRow(p) as never });
      paymentIdMap.set(Number(p.id), created.id);
    }

    for (const r of receipts) {
      await tx.receipt.create({ data: { ...convertRow(r), paymentId: paymentIdMap.get(Number(r.paymentId))! } as never });
    }

    for (const r of revenues) {
      await tx.revenue.create({ data: convertRow(r) as never });
    }

    for (const e of expenses) {
      await tx.expense.create({ data: convertRow(e) as never });
    }

    for (const r of refunds) {
      await tx.refund.create({ data: convertRow(r) as never });
    }
  });

  console.log("تم النقل بنجاح (معاملة واحدة)");

  const balances = await prisma.student.findMany({
    orderBy: { id: "asc" },
    include: { transactions: true },
  });
  for (const s of balances) {
    const bal = s.transactions.reduce((a, t) => a + t.amount, 0);
    console.log(`${s.id} | ${s.firstName} ${s.lastName} | ${s.academicYear} | متبقي=${bal}`);
  }
}

main()
  .catch((e) => {
    console.error("خطأ:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
