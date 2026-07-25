import { generateMonthlyReceiptsPdf } from "@/app/actions/pdf-actions";
import { formatDinarAmount } from "@/lib/tafqit";
import { notFound } from "next/navigation";
import { AutoPrint, PrintButton } from "../../../print-controls";

export const dynamic = "force-dynamic";

const MONTH_NAMES: Record<number, string> = {
  1: "كانون الثاني", 2: "شباط", 3: "آذار", 4: "نيسان",
  5: "أيار", 6: "حزيران", 7: "تموز", 8: "آب",
  9: "أيلول", 10: "تشرين الأول", 11: "تشرين الثاني", 12: "كانون الأول",
};

export default async function MonthlyPrintPage({
  params,
}: {
  params: Promise<{ year: string; month: string }>;
}) {
  const { year, month } = await params;
  const yearNum = parseInt(year);
  const monthNum = parseInt(month);
  if (isNaN(yearNum) || isNaN(monthNum)) notFound();

  const data = await generateMonthlyReceiptsPdf(yearNum, monthNum);
  const monthName = MONTH_NAMES[monthNum] ?? String(monthNum);

  return (
    <div dir="rtl" className="font-print bg-white text-black text-right p-8 print:p-0 text-sm">
      <style>{"@page { size: A4 landscape; margin: 12mm; }"}</style>
      <AutoPrint />
      <PrintButton />

      <div className="mb-4">
        <h1 className="text-lg font-bold">تقرير وصولات شهري</h1>
        <p className="text-base text-gray-700">{monthName} / {data.year}</p>
      </div>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-gray-300">
            <Th className="w-[7%]">الرقم</Th>
            <Th className="w-[25%]">الاسم</Th>
            <Th className="w-[14%]">رقم الوصل</Th>
            <Th className="w-[16%]">المبلغ</Th>
            <Th className="w-[18%]">الباقي</Th>
            <Th className="w-[20%]" last>ملاحظات</Th>
          </tr>
        </thead>
        <tbody>
          {data.receipts.map((row, i) => (
            <tr key={row.receiptNumber} className={`border-b border-black ${i % 2 === 1 ? "bg-gray-100" : ""}`}>
              <Td>{i + 1}</Td>
              <Td>{row.studentName}</Td>
              <Td>{String(row.receiptNumber).padStart(5, "0")}</Td>
              <Td>{formatDinarAmount(row.amount)}</Td>
              <Td>
                {formatDinarAmount(Math.abs(row.remainingBalance))}
                {row.remainingBalance < 0 ? " (دائن)" : row.remainingBalance > 0 ? " (مدين)" : ""}
              </Td>
              <Td last>{row.notes || "—"}</Td>
            </tr>
          ))}
          {data.receipts.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center py-6 text-gray-500 border-b border-black">
                لا توجد وصولات في هذا الشهر
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="flex flex-row-reverse border-y-2 border-black bg-gray-200 mt-2">
        <div className="w-[54%] text-center py-2 font-bold">{formatDinarAmount(data.totalAmount)}</div>
        <div className="w-[46%] text-center py-2 font-bold">المجموع</div>
      </div>
    </div>
  );
}

function Th({ children, className, last }: { children: React.ReactNode; className?: string; last?: boolean }) {
  return (
    <th className={`border-y-2 border-black py-1.5 px-1 font-bold ${last ? "" : "border-e"} ${className ?? ""}`}>
      {children}
    </th>
  );
}

function Td({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return <td className={`py-1 px-1 text-center ${last ? "" : "border-e border-gray-300"}`}>{children}</td>;
}
