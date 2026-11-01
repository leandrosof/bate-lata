import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  History,
  Home,
  Repeat,
  Settings,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  requiresRanking?: boolean;
  bottom?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/inicio", label: "Início", short: "Início", icon: Home, bottom: true },
  { href: "/jogos", label: "Próximos jogos", short: "Jogos", icon: CalendarDays },
  { href: "/presencas", label: "Presenças", short: "Presenças", icon: ClipboardCheck },
  { href: "/racha", label: "Racha", short: "Racha", icon: Repeat, bottom: true },
  { href: "/partidas", label: "Partidas e placares", short: "Partidas", icon: Trophy, bottom: true },
  { href: "/historico", label: "Histórico", short: "Histórico", icon: History },
  { href: "/ranking", label: "Ranking", short: "Ranking", icon: BarChart3, requiresRanking: true, bottom: true },
  { href: "/jogadores", label: "Jogadores", short: "Jogadores", icon: Users },
  { href: "/perfil", label: "Meu perfil", short: "Perfil", icon: UserRound, bottom: true },
  { href: "/admin", label: "Administração", short: "Admin", icon: Settings, adminOnly: true },
];

export function visibleNavItems(options: { isAdmin: boolean; rankingEnabled: boolean }): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    if (item.adminOnly && !options.isAdmin) return false;
    if (item.requiresRanking && !options.rankingEnabled) return false;
    return true;
  });
}

export function bottomNavItems(options: { isAdmin: boolean; rankingEnabled: boolean }): NavItem[] {
  const items = visibleNavItems(options).filter((item) => item.bottom);
  if (items.length < 5) {
    const fallback = visibleNavItems(options).find((item) => item.href === "/jogadores");
    if (fallback && !items.includes(fallback)) items.push(fallback);
  }
  return items.slice(0, 5);
}
