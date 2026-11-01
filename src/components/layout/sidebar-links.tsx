"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { visibleNavItems } from "./nav-config";

export function SidebarLinks({
  isAdmin,
  rankingEnabled,
}: {
  isAdmin: boolean;
  rankingEnabled: boolean;
}) {
  const pathname = usePathname();
  const items = visibleNavItems({ isAdmin, rankingEnabled });

  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2" aria-label="Navegação principal">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition duration-200",
              active
                ? "bg-brand/10 font-semibold text-white shadow-[inset_3px_0_0_0_#3b82f6]"
                : "text-muted hover:bg-white/[0.04] hover:text-ink",
            )}
          >
            <Icon
              className={cn("h-5 w-5 transition", active ? "text-brand" : "text-muted group-hover:text-ink")}
              aria-hidden
            />
            <span className="truncate">{item.label}</span>
            {item.adminOnly ? (
              <span className="ml-auto rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted">
                Admin
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
