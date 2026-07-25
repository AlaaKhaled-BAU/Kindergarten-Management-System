import { generateReceiptPdf } from "@/app/actions/pdf-actions";
import { numberToArabicWords, splitDinarFils } from "@/lib/tafqit";
import { getSetting } from "@/lib/settings";
import { notFound } from "next/navigation";
import { AutoPrint, PrintButton } from "../../print-controls";

export const dynamic = "force-dynamic";

export default async function ReceiptPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const receiptId = parseInt(id);
  if (isNaN(receiptId)) notFound();

  // generateReceiptPdf uses findUniqueOrThrow -- a nonexistent id throws
  // rather than returning null, so a plain `if (!data)` guard can't catch it.
  const [data, address, phone, email] = await Promise.all([
    generateReceiptPdf(receiptId).catch(() => null),
    getSetting("kindergartenAddress"),
    getSetting("kindergartenPhone"),
    getSetting("kindergartenEmail"),
  ]);
  if (!data) notFound();

  const { dinars, fils } = splitDinarFils(data.amount);
  const amountWords = numberToArabicWords(data.amount);
  const contactLine = [address, phone].filter(Boolean).join(" - ");

  return (
    <div className="font-print bg-white text-black p-8 print:p-0 max-w-2xl mx-auto">
      <style>{"@page { size: A5 landscape; margin: 12mm; }"}</style>
      <AutoPrint />
      <PrintButton />

      <div className="flex flex-row-reverse justify-between items-start mb-4">
        <div>
          <h1 className="text-xl font-bold">{data.kindergartenName}</h1>
          {contactLine && <p className="text-xs text-gray-600 mt-1">{contactLine}</p>}
          {email && <p className="text-xs text-gray-600">{email}</p>}
        </div>
      </div>

      <div className="flex flex-row-reverse justify-center items-center gap-4 my-3">
        <div className="flex flex-row-reverse gap-2">
          <div className="border border-black px-3 py-1 text-center min-w-16">
            <div className="text-xs">فلس</div>
            <div className="text-base font-bold">{String(fils).padStart(3, "0")}</div>
          </div>
          <div className="border border-black px-3 py-1 text-center min-w-16">
            <div className="text-xs">دينار</div>
            <div className="text-base font-bold">{dinars}</div>
          </div>
        </div>
        <h2 className="text-lg font-bold underline">سند قبض</h2>
        <div className="text-sm font-bold">رقم {String(data.receiptNumber).padStart(5, "0")}</div>
      </div>

      <DottedRow label="التاريخ" value={data.issueDate} />
      <DottedRow label="وصلنا من السادة" value={data.studentName} />
      <DottedRow label="مبلغ وقدره" value={amountWords} />
      <DottedRow label="وذلك عن" value={data.paymentReason ?? "رسوم دراسية"} />

      <div className="flex flex-row-reverse items-center gap-2 mt-2">
        <span className="size-3 rounded-full border border-black" />
        <span className="text-sm">{data.paymentMethod}</span>
      </div>

      <div className="flex flex-row-reverse mt-10">
        <div className="w-1/2 text-center">
          <div className="border-b border-dotted border-black pb-1">....................</div>
          <div className="text-xs mt-1">توقيع المستلم</div>
        </div>
      </div>
    </div>
  );
}

function DottedRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-row-reverse border-b border-dotted border-gray-400 py-1.5 mb-0.5">
      <span className="font-bold text-sm min-w-28 ms-2">{label} :</span>
      <span className="text-sm flex-1 text-right">...... {value} ......</span>
    </div>
  );
}
