import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarDays, KeyRound, LogOut, Mail, ShieldCheck, Trophy, UserRound } from "lucide-react";
import {
  changePasswordAction,
  logoutEverywhereAction,
  updateEmailPreferencesAction,
  updateProfileAction,
} from "@/actions/profile";
import { AvatarUpload } from "@/components/features/avatar-upload";
import { DeleteAccountDialog } from "@/components/features/delete-account-dialog";
import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Switch } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat";
import { SubmitButton } from "@/components/ui/submit-button";
import { listPlayerGames } from "@/db/queries/games";
import { getPlayerRankingEntry } from "@/db/queries/ranking";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatDateLong, formatDateShort } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Meu perfil" };

export default async function ProfilePage() {
  const user = await requireUser();
  const settings = await getSettings();

  const [overall, games] = await Promise.all([
    getPlayerRankingEntry(user.id, { from: null, to: null }, settings.pointsWin, settings.pointsLoss),
    listPlayerGames(user.id, 5),
  ]);
  const stats = overall.entry;
  const isAdmin = user.role === "ADMIN";

  return (
    <div>
      <PageHeader
        eyebrow="Sua conta"
        title="Meu perfil"
        subtitle="Atualize seus dados, foto e senha."
        icon={<UserRound className="h-5 w-5" />}
        action={
          <Link
            href={`/jogadores/${user.id}`}
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
          >
            Ver perfil público
          </Link>
        }
      />

      <div className="space-y-4">
        <Card>
          <CardBody className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-semibold uppercase tracking-wide text-ink">
                  {user.name}
                </h2>
                <p className="text-sm text-muted">{user.email}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge tone={isAdmin ? "brand" : "neutral"}>{isAdmin ? "Administrador" : "Jogador"}</Badge>
                  <span className="text-[11px] text-muted">
                    No grupo desde {formatDateLong(user.createdAt, settings.timezone)}
                  </span>
                </div>
              </div>
              {isAdmin ? (
                <Link href="/admin" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                  Painel admin
                </Link>
              ) : null}
            </div>
            <AvatarUpload
              userId={user.id}
              name={user.name}
              version={user.avatarUpdatedAt}
              hasOriginal={Boolean(user.avatarOriginalMime)}
            />
          </CardBody>
        </Card>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard label="Partidas" value={stats?.played ?? 0} icon={<Trophy className="h-4 w-4" />} accent="brand" />
          <StatCard label="Vitórias" value={stats?.wins ?? 0} icon={<Trophy className="h-4 w-4" />} accent="success" />
          <StatCard label="Aproveitamento" value={`${stats?.winRate ?? 0}%`} icon={<Trophy className="h-4 w-4" />} accent="warning" />
          <StatCard
            label="Posição"
            value={stats ? `#${stats.position}` : "—"}
            hint={settings.rankingEnabled ? "ranking geral" : "ranking desativado"}
            icon={<Trophy className="h-4 w-4" />}
            accent="neutral"
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Dados do perfil</CardTitle>
            </CardHeader>
            <CardBody className="pt-2">
              <ActionForm
                action={updateProfileAction}
                submitLabel="Salvar alterações"
              >
                <div key={`profile-fields-${user.id}-${user.updatedAt.getTime()}`} className="space-y-3.5">
                <div>
                  <Label htmlFor="name" required>
                    Nome
                  </Label>
                  <Input id="name" name="name" defaultValue={user.name} required maxLength={80} autoComplete="name" />
                </div>
                <div>
                  <Label htmlFor="nickname">Apelido</Label>
                  <Input
                    id="nickname"
                    name="nickname"
                    defaultValue={user.nickname ?? ""}
                    maxLength={30}
                    placeholder="Como o grupo te chama"
                  />
                </div>
                <div>
                  <Label htmlFor="email-display">E-mail</Label>
                  <Input id="email-display" value={user.email} disabled readOnly />
                  <p className="mt-1 text-[11px] text-muted">
                    O e-mail é usado para login e recuperação de senha.
                  </p>
                </div>
                </div>
              </ActionForm>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alterar senha</CardTitle>
              <KeyRound className="h-4 w-4 text-muted" aria-hidden />
            </CardHeader>
            <CardBody className="pt-2">
              <ActionForm action={changePasswordAction} submitLabel="Alterar senha" pendingLabel="Alterando...">
                <div>
                  <Label htmlFor="currentPassword" required>
                    Senha atual
                  </Label>
                  <Input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="password" required>
                    Nova senha
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="confirmPassword" required>
                    Confirmar nova senha
                  </Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                  />
                </div>
                <Alert tone="info">
                  Ao trocar a senha, todos os outros dispositivos são desconectados. Este continua conectado.
                </Alert>
              </ActionForm>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Seus últimos jogos</CardTitle>
            <Link href="/historico" className="text-xs font-semibold text-brand hover:text-ink">
              Histórico
            </Link>
          </CardHeader>
          <CardBody className="pt-2">
            {games.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="h-5 w-5" />}
                title="Nenhuma partida ainda"
                description="Confirme presença no próximo jogo e entre no sorteio."
              />
            ) : (
              <ul className="divide-y divide-line/60">
                {games.map((game) => {
                  const inTeamA = game.teamAPlayers.some((member) => member.userId === user.id);
                  const myTeamId = inTeamA ? game.teamAId : game.teamBId;
                  const won = game.winnerTeamId === myTeamId;
                  return (
                    <li key={game.id}>
                      <Link
                        href={`/partidas?jogo=${game.id}`}
                        className="flex items-center gap-2 py-2.5 transition hover:bg-ink/[0.02]"
                      >
                        <span
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold",
                            won
                              ? "bg-[rgba(34,197,94,0.14)] text-success"
                              : "bg-[rgba(240,82,82,0.12)] text-danger",
                          )}
                        >
                          {won ? "V" : "D"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-ink">
                            {game.teamAName} {game.scoreA} × {game.scoreB} {game.teamBName}
                          </span>
                          <span className="block truncate text-[11px] text-muted">
                            {game.eventTitle} · {formatDateShort(game.finishedAt ?? game.createdAt, settings.timezone)}
                          </span>
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Comunicação</CardTitle>
            <Mail className="h-4 w-4 text-muted" aria-hidden />
          </CardHeader>
          <CardBody className="space-y-3 pt-2">
            <ActionForm action={updateEmailPreferencesAction} submitLabel="Salvar preferências">
              <div key={`email-prefs-${user.id}-${user.updatedAt.getTime()}`}>
                <Switch
                  name="emailNotifications"
                  label="Receber e-mails de novos jogos, avisos e lembretes"
                  description="E-mails de segurança, confirmação de presença e alterações de conta continuam sendo enviados."
                  defaultChecked={user.emailNotifications}
                />
              </div>
            </ActionForm>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sessões e segurança</CardTitle>
            <LogOut className="h-4 w-4 text-muted" aria-hidden />
          </CardHeader>
          <CardBody className="space-y-3 pt-2">
            <p className="text-sm text-muted">
              Encerre a sessão em todos os dispositivos, inclusive este, se desconfiar de acessos indevidos.
            </p>
            <form action={logoutEverywhereAction}>
              <SubmitButton
                label="Sair de todos os dispositivos"
                variant="danger"
                size="sm"
                icon={<LogOut className="h-4 w-4" aria-hidden />}
              />
            </form>
          </CardBody>
        </Card>

        <Card className="border-[rgba(240,82,82,0.25)]">
          <CardHeader>
            <CardTitle>Zona de perigo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-danger" aria-hidden />
          </CardHeader>
          <CardBody className="space-y-3 pt-2">
            <p className="text-sm text-muted">
              Excluir a conta remove seus dados pessoais, encerra suas sessões e desativa o acesso. O
              histórico de partidas do grupo é preservado de forma anônima.
            </p>
            <DeleteAccountDialog />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
