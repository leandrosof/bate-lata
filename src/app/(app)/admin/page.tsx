import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  History,
  Megaphone,
  Settings,
  ShieldCheck,
  Trophy,
  UserCog,
  Users,
} from "lucide-react";
import { listAnnouncements } from "@/db/queries/announcements";
import { listAuditLogs } from "@/db/queries/audit";
import { getActiveOperationalEvent, getNextEvent, getEventRoster, listAllEvents } from "@/db/queries/events";
import { listAllPlayers, countGamesPlayed } from "@/db/queries/players";
import { AutoRefresh } from "@/components/features/auto-refresh";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle, SectionTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat";
import { getSettings } from "@/lib/settings";
import { formatDateShort, formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Painel do administrador" };

const actionLabels: Record<string, string> = {
  "event.create": "criou um evento",
  "event.update": "editou um evento",
  "event.status": "alterou o status de um evento",
  "event.capacity": "aumentou as vagas de um evento",
  "draw.generate": "gerou um sorteio",
  "draw.end": "encerrou uma rodada",
  "draw.discard": "descartou um sorteio",
  "racha.team_size": "alterou os jogadores por time",
  "game.start": "iniciou uma partida",
  "game.finish": "encerrou uma partida",
  "game.correct": "corrigiu um resultado",
  "game.cancel": "cancelou uma partida",
  "announcement.create": "publicou um aviso",
  "announcement.update": "editou um aviso",
  "announcement.delete": "removeu um aviso",
  "player.promote": "promoveu um administrador",
  "player.demote": "removeu acesso de administrador",
  "player.activate": "reativou um jogador",
  "player.deactivate": "desativou um jogador",
  "player.reset-link": "gerou link de redefinição",
  "account.delete": "excluiu a própria conta",
  "settings.update": "atualizou as configurações",
  "season.create": "criou uma temporada",
  "season.update": "editou uma temporada",
  "season.activate": "ativou uma temporada",
};

export default async function AdminHomePage() {
  const settings = await getSettings();
  const [events, players, gamesCount, announcements, audit, activeEvent, scheduledEvent] = await Promise.all([
    listAllEvents(8),
    listAllPlayers(),
    countGamesPlayed(),
    listAnnouncements(3),
    listAuditLogs(8),
    getActiveOperationalEvent(),
    getNextEvent(),
  ]);
  const nextEvent = activeEvent ?? scheduledEvent;

  const roster = nextEvent ? await getEventRoster(nextEvent.id) : null;
  const upcoming = events.filter((event) => event.status === "SCHEDULED").length;
  const activePlayers = players.filter((player) => player.active).length;

  const quickLinks = [
    { href: "/admin/eventos", label: "Criar evento", icon: CalendarDays, description: "Data, local e vagas" },
    { href: "/presencas", label: "Presenças", icon: ClipboardCheck, description: "Lista e fila de espera" },
    { href: "/admin/avisos", label: "Publicar aviso", icon: Megaphone, description: "Comunicados do grupo" },
    { href: "/admin/jogadores", label: "Jogadores", icon: UserCog, description: "Permissões e acessos" },
    { href: "/admin/resultados", label: "Resultados", icon: Trophy, description: "Corrigir placares" },
    { href: "/admin/config", label: "Configurações", icon: Settings, description: "Ranking, pontos e temporadas" },
  ];

  return (
    <div className="space-y-5">
      <AutoRefresh intervalMs={60000} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Jogadores ativos" value={activePlayers} icon={<Users className="h-4 w-4" />} accent="brand" />
        <StatCard label="Eventos futuros" value={upcoming} icon={<CalendarDays className="h-4 w-4" />} accent="success" />
        <StatCard label="Partidas encerradas" value={gamesCount} icon={<History className="h-4 w-4" />} accent="neutral" />
        <StatCard
          label="Ranking"
          value={settings.rankingEnabled ? "On" : "Off"}
          hint={`${settings.pointsWin} pts/vitória`}
          icon={<BarChart3 className="h-4 w-4" />}
          accent={settings.rankingEnabled ? "success" : "danger"}
        />
      </div>

      <section>
        <SectionTitle title="Ações rápidas" subtitle="O que você precisa fazer agora" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="card group flex items-center gap-3 p-3.5 transition hover:border-brand/40"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{link.label}</span>
                  <span className="block truncate text-[11px] text-muted">{link.description}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-muted transition group-hover:text-ink" aria-hidden />
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Próximo evento</CardTitle>
            <Link href="/admin/eventos" className="text-xs font-semibold text-brand hover:text-ink">
              Gerenciar
            </Link>
          </CardHeader>
          <CardBody className="pt-2">
            {!nextEvent ? (
              <EmptyState
                icon={<CalendarDays className="h-5 w-5" />}
                title="Nenhum evento agendado"
                action={
                  <Link href="/admin/eventos" className={cn(buttonVariants({ size: "sm" }))}>
                    Criar evento
                  </Link>
                }
              />
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display text-xl font-semibold uppercase tracking-wide text-ink">
                    {nextEvent.title}
                  </p>
                  <Badge tone="brand">{formatDateShort(nextEvent.startsAt, settings.timezone)}</Badge>
                </div>
                <p className="text-sm text-muted">{formatDateTime(nextEvent.startsAt, settings.timezone)}</p>
                <p className="text-sm text-muted">
                  {nextEvent.venueName}
                  {nextEvent.address ? ` · ${nextEvent.address}` : ""}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge tone="success">{nextEvent.confirmedCount} confirmados</Badge>
                  <Badge tone="brand">{nextEvent.checkedInCount} já chegaram</Badge>
                  <Badge tone="warning">{nextEvent.waitlistCount} na espera</Badge>
                  <Badge>{roster?.pending.length ?? 0} sem resposta</Badge>
                  <Badge tone="brand">{nextEvent.maxPlayers} vagas</Badge>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link href={`/presencas?evento=${nextEvent.id}`} className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
                    Ver presenças
                  </Link>
                  <Link href={`/racha?evento=${nextEvent.id}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                    Abrir racha
                  </Link>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Atividade recente</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted" aria-hidden />
          </CardHeader>
          <CardBody className="pt-2">
            {audit.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">Nenhuma ação administrativa registrada ainda.</p>
            ) : (
              <ul className="space-y-1.5">
                {audit.map((entry) => (
                  <li key={entry.id} className="rounded-lg border border-line/60 px-2.5 py-1.5">
                    <p className="text-xs text-ink/90">
                      <span className="font-medium">{entry.actorName ?? "Sistema"}</span>{" "}
                      {actionLabels[entry.action] ?? entry.action}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-muted">
                      {formatDateTime(entry.createdAt, settings.timezone)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <section>
        <SectionTitle title="Avisos recentes" action={<Link href="/admin/avisos" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>Gerenciar</Link>} />
        {announcements.length === 0 ? (
          <EmptyState icon={<Megaphone className="h-5 w-5" />} title="Nenhum aviso" description="Publique o primeiro comunicado." />
        ) : (
          <div className="space-y-2">
            {announcements.map((announcement) => (
              <div key={announcement.id} className="card flex items-center gap-3 p-3">
                <Megaphone className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{announcement.title}</p>
                  <p className="truncate text-[11px] text-muted">{announcement.body}</p>
                </div>
                {announcement.pinned ? <Badge tone="warning">Fixado</Badge> : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
