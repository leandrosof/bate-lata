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
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              active
                ? "bg-brand/15 text-white shadow-[inset_2px_0_0_0_#2f6bff]"
                : "text-muted hover:bg-white/5 hover:text-ink",
            )}
          >
            <Icon
              className={cn("h-[18px] w-[18px] transition", active ? "text-[#7fa2ff]" : "text-muted group-hover:text-ink")}
              aria-hidden
            />
            <span className="truncate">{item.label}</span>
            {item.adminOnly ? (
              <span className="ml-auto rounded bg-white/8 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted">
                Admin
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
