import { Brand } from "@/components/layout/brand";
import { getSettings } from "@/lib/settings";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-32 -top-24 h-[360px] w-[360px] rounded-full bg-brand/20 blur-[110px]" />
        <div className="absolute -right-24 bottom-0 h-[300px] w-[300px] rounded-full bg-[#38bdf8]/10 blur-[100px]" />
      </div>

      <header className="relative px-5 py-5 sm:px-8">
        <Brand
          siteName={settings.siteName}
          tagline={settings.tagline}
          logoUrl={settings.logoUrl || "/logo.png"}
          href="/"
        />
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 pb-12 sm:px-6">
        <div className="w-full max-w-md animate-[rise_0.4s_ease-out_both]">{children}</div>
      </main>

      <footer className="relative px-5 pb-6 text-center text-[11px] uppercase tracking-[0.18em] text-muted/70">
        {settings.siteName} · acesso restrito ao grupo
      </footer>
    </div>
  );
}
