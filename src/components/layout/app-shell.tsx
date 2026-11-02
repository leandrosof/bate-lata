import Link from "next/link";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { Avatar } from "@/components/ui/avatar";
import type { Settings, User } from "@/db/schema";
import { BottomNav } from "./bottom-nav";
import { Brand } from "./brand";
import { OfflineBanner } from "./offline-banner";
import { SidebarLinks } from "./sidebar-links";
import { ThemeToggle } from "./theme-toggle";

export function AppShell({
  user,
  settings,
  children,
}: {
  user: User;
  settings: Settings;
  children: React.ReactNode;
}) {
  const isAdmin = user.role === "ADMIN";
  const logoUrl = settings.logoData
    ? `/api/logo?v=${settings.logoUpdatedAt?.getTime() ?? 0}`
    : settings.logoUrl;

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-surface/90 backdrop-blur-md lg:flex">
        <div className="px-5 py-6">
          <Brand siteName={settings.siteName} tagline={settings.tagline} logoUrl={logoUrl} />
        </div>
        <SidebarLinks isAdmin={isAdmin} rankingEnabled={settings.rankingEnabled} />
        <div className="border-t border-line/60 p-3">
          <div className="mb-2 flex items-center justify-between rounded-xl border border-line/60 px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Tema</span>
            <ThemeToggle />
          </div>
          <Link
            href="/perfil"
            className="flex items-center gap-3 rounded-2xl p-2.5 transition hover:bg-ink/[0.05]"
          >
            <Avatar userId={user.id} name={user.name} version={user.avatarUpdatedAt} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{user.name}</span>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">
                {isAdmin ? "Administrador" : "Jogador"}
              </span>
            </span>
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted transition hover:bg-danger-soft hover:text-danger"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sair
            </button>
          </form>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md lg:hidden">
          <div className="flex h-16 items-center justify-between gap-3 px-4">
            <Brand
              compact
              siteName={settings.siteName}
              tagline={settings.tagline}
              logoUrl={logoUrl}
            />
            <div className="flex items-center gap-2.5">
              <ThemeToggle />
              {isAdmin ? (
                <Link
                  href="/admin"
                  className="rounded-lg border border-brand/30 bg-brand/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-brand"
                >
                  Admin
                </Link>
              ) : null}
              <Link href="/perfil" aria-label="Meu perfil">
                <Avatar userId={user.id} name={user.name} version={user.avatarUpdatedAt} size="sm" />
              </Link>
            </div>
          </div>
        </header>

        <OfflineBanner />

        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-14 lg:pt-8">
          {children}
        </main>

        <BottomNav
          isAdmin={isAdmin}
          rankingEnabled={settings.rankingEnabled}
          user={{
            id: user.id,
            name: user.name,
            role: user.role,
            avatarUpdatedAt: user.avatarUpdatedAt,
          }}
        />
      </div>
    </div>
  );
}
