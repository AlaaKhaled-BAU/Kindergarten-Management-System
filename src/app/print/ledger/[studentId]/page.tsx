import { generateLedgerPdf } from "@/app/actions/pdf-actions";
import { formatDinarAmount } from "@/lib/tafqit";
import { gradeLabel } from "@/lib/grades";
import { getSetting } from "@/lib/settings";
import { notFound } from "next/navigation";
import { AutoPrint, PrintButton } from "../../print-controls";

export const dynamic = "force-dynamic";

/**
 * Positive balance = charges exceed payments = the family owes the
 * kindergarten ("عليه"). Negative = they've prepaid / are in credit
 * ("له"). The react-pdf version had this backwards.
 */
function owingLabel(amount: number): string {
  if (amount > 0) return " عليه";
  if (amount < 0) return " له";
  return "";
}

export default async function LedgerPrintPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const id = parseInt(studentId);
  if (isNaN(id)) notFound();

  // generateLedgerPdf uses findUniqueOrThrow -- a nonexistent id throws
  // rather than returning null, so a plain `if (!data)` guard can't catch it.
  const [data, kindergartenName] = await Promise.all([
    generateLedgerPdf(id).catch(() => null),
    getSetting("kindergartenName"),
  ]);
  if (!data) notFound();

  return (
    <div dir="rtl" className="font-print bg-white text-black text-right p-8 print:p-0 max-w-3xl mx-auto text-sm">
      <style>{"@page { size: A4; margin: 15mm; }"}</style>
      <AutoPrint />
      <PrintButton />

      <div className="text-center mb-4">
        <h1 className="text-lg font-bold">{kindergartenName}</h1>
        <h2 className="text-base font-bold mt-1">كشف حساب طالب</h2>
        <p className="text-xs text-gray-600 mt-1">السنة الدراسية: {data.academicYear}</p>
      </div>

      <div className="flex flex-row-reverse justify-between border-y border-black py-2 my-3">
        <div className="w-[48%] space-y-1">
          <InfoRow label="اسم الطالب" value={data.studentName} />
          <InfoRow label="الصف" value={gradeLabel(data.grade)} />
          <InfoRow label="الشعبة" value={data.section ?? "—"} />
        </div>
        <div className="w-[48%] space-y-1">
          <InfoRow label="المبلغ المستحق" value={formatDinarAmount(data.totalDue)} />
          <InfoRow label="قيمة الخصم" value={formatDinarAmount(data.discount)} />
          <InfoRow
            label="صافي المبلغ"
            value={formatDinarAmount(Math.abs(data.netAmount)) + owingLabel(data.netAmount)}
          />
        </div>
      </div>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-gray-200">
            <Th className="w-[7%]">الرقم</Th>
            <Th className="w-[16%]">الدفعات</Th>
            <Th className="w-[16%]">تاريخ الدفع</Th>
            <Th className="w-[16%]">رقم الوصل</Th>
            <Th className="w-[20%]">الرصيد</Th>
            <Th className="w-[25%]" last>ملاحظات</Th>
          </tr>
        </thead>
        <tbody>
          {data.transactions.map((t, i) => (
            <tr key={t.id} className="border-b border-black">
              <Td>{i + 1}</Td>
              <Td>{t.credit > 0 ? formatDinarAmount(t.credit) : "—"}</Td>
              <Td>{t.date}</Td>
              <Td>{t.receiptNumber ?? "—"}</Td>
              <Td>{formatDinarAmount(Math.abs(t.balance)) + owingLabel(t.balance)}</Td>
              <Td last>{t.description?.slice(0, 40)}</Td>
            </tr>
          ))}
          {data.transactions.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center py-6 text-gray-500 border-b border-black">
                لا توجد معاملات
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="flex flex-row-reverse justify-between mt-16">
        <div className="w-2/5 text-center">
          <div className="border-t border-black pt-1">توقيع الإدارة</div>
        </div>
        <div className="w-2/5 text-center">
          <div className="border-t border-black pt-1">توقيع ولي الأمر</div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-row-reverse">
      <span className="font-bold min-w-20">{label}:</span>
      <span>{value}</span>
    </div>
  );
}

function Th({ children, className, last }: { children: React.ReactNode; className?: string; last?: boolean }) {
  return (
    <th className={`border-y border-black py-1.5 px-1 font-bold ${last ? "" : "border-e"} ${className ?? ""}`}>
      {children}
    </th>
  );
}

function Td({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return <td className={`py-1 px-1 text-center ${last ? "" : "border-e border-gray-300"}`}>{children}</td>;
}
