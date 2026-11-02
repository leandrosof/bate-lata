import { Search, UserCog, UserMinus, UserPlus, Users } from "lucide-react";
import { managePlayerAction } from "@/actions/admin";
import { Avatar } from "@/components/ui/avatar";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Disclosure } from "@/components/ui/disclosure";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { listAllPlayers } from "@/db/queries/players";
import { requireAdmin } from "@/lib/auth";
import { formatDateShort } from "@/lib/time";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export const metadata = { title: "Jogadores" };

export default async function AdminPlayersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();
  const settings = await getSettings();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const players = await listAllPlayers();

  const normalized = query.toLowerCase();
  const filtered = normalized
    ? players.filter(
        (player) =>
          player.name.toLowerCase().includes(normalized) ||
          player.email.toLowerCase().includes(normalized) ||
          (player.nickname ?? "").toLowerCase().includes(normalized),
      )
    : players;

  return (
    <div>
      <PageHeader
        eyebrow={`${players.filter((player) => player.active).length} ativos`}
        title="Jogadores"
        subtitle="Gerencie permissões, acessos e redefinições de senha."
        icon={<UserCog className="h-5 w-5" />}
      />

      <form action="/admin/jogadores" method="get" className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input name="q" defaultValue={query} placeholder="Buscar por nome ou e-mail" className="pl-9" />
        </div>
        <button type="submit" className={cn(buttonVariants({ variant: "secondary", size: "md" }))}>
          Buscar
        </button>
      </form>

      {filtered.length === 0 ? (
        <EmptyState icon={<Users className="h-5 w-5" />} title="Nenhum jogador encontrado" />
      ) : (
        <div className="space-y-2">
          {filtered.map((player) => {
            const isSelf = player.id === admin.id;
            return (
              <Card key={player.id}>
                <CardBody className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Avatar userId={player.id} name={player.name} version={player.avatarUpdatedAt} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">
                        {player.name}
                        {isSelf ? (
                          <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-brand">
                            você
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-[11px] text-muted">{player.email}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted/70">
                        desde {formatDateShort(player.createdAt, settings.timezone)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge tone={player.role === "ADMIN" ? "brand" : "neutral"}>
                        {player.role === "ADMIN" ? "Admin" : "Jogador"}
                      </Badge>
                      <Badge tone={player.active ? "success" : "danger"}>
                        {player.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </div>

                  <Disclosure title="Gerenciar acesso" subtitle="Permissões, status e redefinição de senha">
                    <div className="flex flex-wrap gap-2">
                      {player.role === "PLAYER" ? (
                        <ActionButton
                          action={managePlayerAction}
                          fields={{ userId: player.id, action: "promote" }}
                          variant="outline"
                          size="sm"
                          icon={<UserPlus className="h-3.5 w-3.5" aria-hidden />}
                        >
                          Tornar admin
                        </ActionButton>
                      ) : (
                        <ActionButton
                          action={managePlayerAction}
                          fields={{ userId: player.id, action: "demote" }}
                          variant="secondary"
                          size="sm"
                          disabled={isSelf}
                          icon={<UserMinus className="h-3.5 w-3.5" aria-hidden />}
                        >
                          Remover admin
                        </ActionButton>
                      )}

                      {player.active ? (
                        <ActionButton
                          action={managePlayerAction}
                          fields={{ userId: player.id, action: "deactivate" }}
                          variant="danger"
                          size="sm"
                          disabled={isSelf}
                          confirmMessage={`Desativar ${player.name}? A conta não poderá entrar no site.`}
                        >
                          Desativar conta
                        </ActionButton>
                      ) : (
                        <ActionButton
                          action={managePlayerAction}
                          fields={{ userId: player.id, action: "activate" }}
                          variant="success"
                          size="sm"
                        >
                          Reativar conta
                        </ActionButton>
                      )}

                      <ActionButton
                        action={managePlayerAction}
                        fields={{ userId: player.id, action: "reset-link" }}
                        variant="ghost"
                        size="sm"
                      >
                        Gerar link de senha
                      </ActionButton>
                    </div>
                    <p className="mt-2 text-[11px] text-muted">
                      Ao gerar o link de redefinição, ele também é enviado para o e-mail do jogador. Se o envio de
                      e-mail não estiver configurado, copie o link exibido e envie pelo WhatsApp.
                    </p>
                  </Disclosure>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
