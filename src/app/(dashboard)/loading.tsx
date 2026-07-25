// Shown instantly on every navigation within the dashboard while the
// server renders the real page, instead of a frozen old page with no
// feedback (every dashboard page is force-dynamic, so every click waits
// on a fresh database round trip).
export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-live="polite">
      <div className="h-8 w-48 rounded-md bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl border bg-card" />
        ))}
      </div>
      <div className="h-64 rounded-xl border bg-card" />
    </div>
  );
}
