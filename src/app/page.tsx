import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  Shuffle,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { buttonVariants } from "@/components/ui/button";
import { getSessionUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { listUpcomingEvents } from "@/db/queries/events";
import { listRecentFinishedGames } from "@/db/queries/games";
import { TeamPill } from "@/components/features/team-card";
import { formatDateLong, formatTime } from "@/lib/time";

export default async function LandingPage() {
  const user = await getSessionUser();
  if (user) redirect("/inicio");

  const settings = await getSettings();
  const upcoming = (await listUpcomingEvents()).filter((event) => event.publicToken).slice(0, 3);
  const recent = await listRecentFinishedGames(4);
  const logoUrl = settings.logoData
    ? `/api/logo?v=${settings.logoUpdatedAt?.getTime() ?? 0}`
    : settings.logoUrl;

  const features = [
    {
      icon: ClipboardCheck,
      title: "Presença sem enrolação",
      text: "Confirme, cancele e acompanhe as vagas em tempo real. Lista de espera automática.",
    },
    {
      icon: Shuffle,
      title: "Sorteio de times justo",
      text: "Times equilibrados sorteados de verdade, com fila para quem ficou de fora.",
    },
    {
      icon: Trophy,
      title: "Placar ao vivo",
      text: "Registre pontos, encerre a partida e mantenha o histórico completo do grupo.",
    },
    {
      icon: BarChart3,
      title: "Ranking do grupo",
      text: "Vitórias, aproveitamento e pontuação por mês e por temporada.",
    },
  ];

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full bg-brand/25 blur-[120px]" />
        <div className="absolute -right-32 top-24 h-[380px] w-[380px] rounded-full bg-[#38bdf8]/12 blur-[110px]" />
        <svg
          className="absolute -right-24 bottom-0 h-[420px] w-[420px] text-white/[0.04]"
          viewBox="0 0 200 200"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="100" cy="100" r="78" />
          <path d="M100 22c34 32 44 55 44 78s-10 46-44 78" />
          <path d="M100 178c-34-32-44-55-44-78s10-46 44-78" />
          <path d="M24 86h152M24 114h152" />
        </svg>
      </div>

      <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 sm:px-8">
        <header className="flex items-center justify-between gap-4 py-6">
          <Brand
            siteName={settings.siteName}
            tagline={settings.tagline}
            logoUrl={logoUrl}
            href="/"
          />
          <div className="flex items-center gap-2">
            <Link href="/entrar" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className={cn(buttonVariants({ variant: "primary", size: "sm" }), "hidden sm:inline-flex")}
            >
              Criar conta
            </Link>
          </div>
        </header>

        <main className="flex flex-1 flex-col justify-center py-10 sm:py-16">
          <div className="max-w-3xl animate-[rise_0.5s_ease-out_both]">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#9db8ff]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Vôlei organizado, de verdade
            </span>
            <h1 className="mt-5 font-display text-5xl font-bold uppercase leading-[0.92] tracking-tight text-white sm:text-7xl">
              Seu grupo de vôlei
              <span className="block text-[#7fa2ff]">fora da bagunça</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Presenças, sorteio automático de times, placar ao vivo, histórico e ranking. Tudo em um só
              lugar — feito para abrir no celular antes do jogo.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/cadastro" className={cn(buttonVariants({ size: "lg" }), "shine")}>
                Começar agora
              </Link>
              <Link
                href="/entrar"
                className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}
              >
                Já tenho conta
              </Link>
            </div>
          </div>

          <div className="mt-12 grid gap-3 sm:mt-16 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="card p-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-[#9db8ff]">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h2 className="mt-3 font-display text-lg font-semibold uppercase tracking-wide text-ink">
                    {feature.title}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{feature.text}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-10 grid gap-3 rounded-2xl border border-line bg-surface/60 p-4 sm:grid-cols-3 sm:p-5">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-[#7fa2ff]" aria-hidden />
              <p className="text-sm text-muted">Próximo jogo com data, local e vagas</p>
            </div>
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-[#7fa2ff]" aria-hidden />
              <p className="text-sm text-muted">Contas individuais para cada jogador</p>
            </div>
            <div className="flex items-center gap-3">
              <Trophy className="h-5 w-5 text-[#7fa2ff]" aria-hidden />
              <p className="text-sm text-muted">Resultados e ranking calculados sozinhos</p>
            </div>
          </div>
          {upcoming.length > 0 ? (
            <section className="mt-10 space-y-3">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#7fa2ff]">Agenda</p>
                  <h2 className="font-display text-2xl font-semibold uppercase tracking-wide text-white">
                    Próximas partidas
                  </h2>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {upcoming.map((event) => (
                  <Link
                    key={event.id}
                    href={`/e/${event.publicToken}`}
                    className="card overflow-hidden transition hover:border-brand/40"
                  >
                    <div className="relative h-24 bg-gradient-to-br from-brand/30 to-[#38bdf8]/10">
                      {event.coverMime ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/event-cover/${event.id}?v=${event.coverUpdatedAt?.getTime() ?? 0}`}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="space-y-1 p-3">
                      <p className="font-display text-base font-semibold uppercase tracking-wide text-ink">
                        {event.title}
                      </p>
                      <p className="text-[11px] text-muted">
                        {formatDateLong(event.startsAt, settings.timezone)} ·{" "}
                        {formatTime(event.startsAt, settings.timezone)}
                      </p>
                      <p className="text-[11px] text-muted">{event.venueName}</p>
                      <p className="text-[11px] font-semibold text-[#86efac]">
                        {Math.max(event.maxPlayers - event.confirmedCount, 0)} vaga(s)
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {recent.length > 0 ? (
            <section className="mt-10 space-y-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#7fa2ff]">Histórico</p>
                <h2 className="font-display text-2xl font-semibold uppercase tracking-wide text-white">
                  Últimos resultados
                </h2>
              </div>
              <div className="space-y-2">
                {recent.map((game) => (
                  <div
                    key={game.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-line/70 bg-surface-2/40 px-3 py-2 text-sm"
                  >
                    <TeamPill name={game.teamAName} color={game.teamAColor} />
                    <span className="font-display text-lg tabular-nums text-white">
                      {game.scoreA} × {game.scoreB}
                    </span>
                    <TeamPill name={game.teamBName} color={game.teamBColor} />
                    <span className="ml-auto text-xs text-muted">{game.eventTitle}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-10 grid gap-3 rounded-2xl border border-line bg-surface/60 p-5 text-sm leading-relaxed text-muted sm:grid-cols-2">
            <div>
              <h2 className="font-display text-xl font-semibold uppercase tracking-wide text-white">
                Sobre o grupo
              </h2>
              <p className="mt-2 whitespace-pre-line">
                {settings.aboutText?.trim() ||
                  "Somos um grupo de amigos que se reúne para jogar vôlei de resenha, sem compromisso profissional. O importante é jogar, se divertir e manter o grupo organizado."}
              </p>
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold uppercase tracking-wide text-white">
                Regras e contato
              </h2>
              <p className="mt-2 whitespace-pre-line">
                {settings.rulesText?.trim() ||
                  "Presença confirmada pelo site. Times montados automaticamente, com rodízio justo. Respeito com todos e boa energia na quadra."}
              </p>
              {settings.contactText ? (
                <p className="mt-2 whitespace-pre-line">{settings.contactText}</p>
              ) : null}
            </div>
          </section>        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-5 text-xs text-muted">
          <p>
            {settings.siteName} · {settings.tagline}
          </p>
          <p>Feito para o nosso grupo de vôlei.</p>
        </footer>
      </div>
    </div>
  );
}
