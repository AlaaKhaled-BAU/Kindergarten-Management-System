"use client";

// Catches errors thrown by the root layout itself, so must render its own
// <html>/<body> and can't rely on Tailwind/globals.css having loaded --
// kept deliberately dependency-free.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ fontFamily: "sans-serif", textAlign: "center", padding: "60px" }}>
        <h2>حدث خطأ في النظام</h2>
        <p>الرجاء إعادة تشغيل البرنامج. إذا استمرت المشكلة، تواصل مع الدعم الفني.</p>
        <button onClick={reset} style={{ marginTop: 16, padding: "8px 16px" }}>
          إعادة المحاولة
        </button>
      </body>
    </html>
  );
}
