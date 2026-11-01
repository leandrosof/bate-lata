"use client";

import { usePathname } from "next/navigation";
import { LinkTabs } from "@/components/ui/tabs";

const items = [
  { href: "/admin", label: "Visão geral" },
  { href: "/admin/eventos", label: "Eventos" },
  { href: "/presencas", label: "Presenças" },
  { href: "/admin/avisos", label: "Avisos" },
  { href: "/admin/jogadores", label: "Jogadores" },
  { href: "/admin/resultados", label: "Resultados" },
  { href: "/admin/config", label: "Configurações" },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <LinkTabs
      className="mb-4"
      items={items.map((item) => ({
        ...item,
        active: pathname === item.href,
      }))}
    />
  );
}
