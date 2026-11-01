"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { cn, initials } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { bottomNavItems, visibleNavItems } from "./nav-config";

export function BottomNav({
  isAdmin,
  rankingEnabled,
  user,
}: {
  isAdmin: boolean;
  rankingEnabled: boolean;
  user: { id: string; name: string; role: string; avatarUpdatedAt: Date | null };
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = bottomNavItems({ isAdmin, rankingEnabled }).slice(0, 4);
  const allItems = visibleNavItems({ isAdmin, rankingEnabled });

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  return (
    <>
      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-3 pt-2 backdrop-blur-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.4)] lg:hidden"
        aria-label="Navegação rápida"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-[11px] font-semibold transition active:scale-95",
                  active ? "text-white font-bold" : "text-muted hover:text-ink",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200",
                    active
                      ? "bg-brand text-white shadow-[0_4px_14px_rgba(59,130,246,0.5)] scale-105"
                      : "text-muted hover:bg-white/5",
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="truncate">{item.short}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-[11px] font-semibold text-muted transition hover:text-ink active:scale-95"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-white/5">
              <Menu className="h-5 w-5" aria-hidden />
            </span>
            Mais
          </button>
        </div>
      </nav>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-line bg-[#0a1120] p-4 pb-8 animate-[rise_0.25s_ease-out_both]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
            <div className="mb-4 flex items-center justify-between">
              <span className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-muted">
                Menu
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <Link href="/perfil" onClick={() => setOpen(false)} className="mb-4 flex items-center gap-3 rounded-xl border border-line bg-surface-2/60 p-3">
              <Avatar userId={user.id} name={user.name} version={user.avatarUpdatedAt} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{user.name}</span>
                <span className="block text-[11px] uppercase tracking-wider text-muted">
                  {user.role === "ADMIN" ? "Administrador" : "Jogador"}
                </span>
              </span>
            </Link>

            <div className="grid grid-cols-2 gap-2">
              {allItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition",
                      active
                        ? "border-brand/40 bg-brand/15 text-white"
                        : "border-line bg-surface-2/50 text-muted",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>

            <form action={logoutAction} className="mt-4">
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[rgba(240,82,82,0.3)] bg-[rgba(240,82,82,0.1)] py-3 text-sm font-semibold text-[#ff9a9a] transition active:bg-[rgba(240,82,82,0.2)]"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                Sair da conta
              </button>
            </form>

            <p className="mt-4 text-center text-[10px] uppercase tracking-[0.2em] text-muted/60">
              {initials(user.name)} · Arena do Vôlei
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
