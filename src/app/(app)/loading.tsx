export default function AppLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <div className="skeleton h-3 w-32 rounded-full" />
        <div className="skeleton h-9 w-64 rounded-xl" />
      </div>
      <div className="skeleton h-48 w-full rounded-2xl" />
      <div className="grid grid-cols-3 gap-2">
        <div className="skeleton h-24 rounded-2xl" />
        <div className="skeleton h-24 rounded-2xl" />
        <div className="skeleton h-24 rounded-2xl" />
      </div>
      <div className="skeleton h-32 w-full rounded-2xl" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
