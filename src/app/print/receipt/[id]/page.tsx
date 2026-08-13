import { generateReceiptPdf, type ReceiptPdfData } from "@/app/actions/pdf-actions";
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
  const [data, address, phone, email, logoPath] = await Promise.all([
    generateReceiptPdf(receiptId).catch(() => null),
    getSetting("kindergartenAddress"),
    getSetting("kindergartenPhone"),
    getSetting("kindergartenEmail"),
    getSetting("kindergartenLogo"),
  ]);
  if (!data) notFound();

  const contactLine = [address, phone].filter(Boolean).join(" - ");
  const logoUrl = logoPath?.trim() || "/icon.png";

  return (
    // Two identical copies stacked on one A4 portrait page (exactly two
    // A5-landscape halves) -- one for the kindergarten's own records, one
    // for the parent, meant to be cut along the dashed line. Printing one
    // A5 receipt at a time wasted a full sheet of paper per payment.
    <div dir="rtl" className="relative font-print bg-white text-black text-right print:p-0">
      <style>{"@page { size: A4 portrait; margin: 10mm; }"}</style>
      <AutoPrint />
      <PrintButton />

      {data.isCanceled && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="-rotate-30 rounded-lg border-8 border-red-600/60 px-8 py-3 text-6xl font-bold text-red-600/60">
            إيصال ملغي
          </div>
        </div>
      )}

      <div className="h-[134mm]">
        <ReceiptCopy data={data} contactLine={contactLine} email={email} logoUrl={logoUrl} copyLabel="نسخة الروضة" />
      </div>

      <div className="flex items-center gap-2 text-gray-400 my-1" aria-hidden="true">
        <div className="flex-1 border-t border-dashed border-gray-400" />
        <span className="text-xs">✂ يُقص من هنا</span>
        <div className="flex-1 border-t border-dashed border-gray-400" />
      </div>

      <div className="h-[134mm]">
        <ReceiptCopy data={data} contactLine={contactLine} email={email} logoUrl={logoUrl} copyLabel="نسخة ولي الأمر" />
      </div>
    </div>
  );
}

function ReceiptCopy({
  data,
  contactLine,
  email,
  logoUrl,
  copyLabel,
}: {
  data: ReceiptPdfData;
  contactLine: string;
  email: string | undefined;
  logoUrl: string;
  copyLabel: string;
}) {
  const { dinars, fils } = splitDinarFils(data.amount);
  const amountWords = numberToArabicWords(data.amount);

  return (
    <div className="h-full p-4 flex flex-col">
      <div className="flex justify-between items-start gap-3 mb-3">
        <div className="flex items-start gap-3 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt=""
            className="h-12 w-12 shrink-0 object-contain"
          />
          <div className="min-w-0">
            <h1 className="text-xl font-bold">{data.kindergartenName}</h1>
            {contactLine && <p className="text-xs text-gray-600 mt-1">{contactLine}</p>}
            {email && <p className="text-xs text-gray-600">{email}</p>}
          </div>
        </div>
        <span className="shrink-0 text-xs text-gray-500 border border-gray-400 rounded px-2 py-0.5">{copyLabel}</span>
      </div>

      <div className="flex justify-center items-center gap-4 my-3">
        <div className="flex gap-2">
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

      {data.isCanceled && (
        <p className="text-center text-xs font-bold text-red-700 mb-2">
          ملغي بتاريخ {data.cancelDate ?? "—"}{data.cancelReason ? ` — السبب: ${data.cancelReason}` : ""}
        </p>
      )}

      <InfoRow label="التاريخ" value={data.issueDate} />
      <InfoRow label="وصلنا من ولي أمر الطالب" value={data.studentName} />
      <InfoRow label="مبلغ وقدره" value={amountWords} />
      <InfoRow label="وذلك عن" value={data.paymentReason ?? "رسوم دراسية"} />

      <div className="flex items-center gap-2 mt-2">
        <span className="text-sm">{data.paymentMethod}</span>
        <span className="size-3 rounded-full border border-black shrink-0" />
      </div>

      <div className="flex justify-end mt-auto pt-4">
        <div className="w-1/2 text-center">
          <div className="border-t border-black pt-1 text-xs">توقيع المستلم</div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex border-b border-gray-300 py-1.5">
      <span className="font-bold text-sm min-w-36 me-2 shrink-0">{label} :</span>
      <span className="text-sm flex-1">{value}</span>
    </div>
  );
}
