import Link from "next/link";
import { Briefcase, CalendarDays, Clock, MapPin, Pencil, Users } from "lucide-react";
import { setEventStatusAction, updateEventAction } from "@/actions/admin";
import { ActionButton } from "@/components/ui/action-button";
import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Disclosure } from "@/components/ui/disclosure";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Select, Switch, Textarea } from "@/components/ui/input";
import { EventCoverUpload } from "@/components/features/image-uploads";
import { EventPriceBadge } from "@/components/features/event-price-badge";
import { ShareEventButton } from "@/components/features/share-event-button";
import { SurfaceBadge } from "@/components/features/surface-badge";
import { Progress } from "@/components/ui/progress";
import { listAllEvents } from "@/db/queries/events";
import { getSettings } from "@/lib/settings";
import { formatTime, toDateTimeLocal } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { EventRow } from "@/db/schema";

export const metadata = { title: "Eventos" };

function EventFields({
  event,
  timeZone,
  idPrefix,
}: {
  event?: EventRow;
  timeZone: string;
  idPrefix: string;
}) {
  return (
    <>
      <div>
        <Label htmlFor={`${idPrefix}-title`} required>
          Título do evento
        </Label>
        <Input
          id={`${idPrefix}-title`}
          name="title"
          defaultValue={event?.title ?? "Vôlei de sábado"}
          required
          minLength={3}
          maxLength={90}
          placeholder="Ex.: Vôlei de sábado"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor={`${idPrefix}-starts`} required>
            Início
          </Label>
          <Input
            id={`${idPrefix}-starts`}
            name="startsAt"
            type="datetime-local"
            defaultValue={event ? toDateTimeLocal(event.startsAt, timeZone) : ""}
            required
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-ends`} required>
            Fim
          </Label>
          <Input
            id={`${idPrefix}-ends`}
            name="endsAt"
            type="datetime-local"
            defaultValue={
              event?.endsAt ? toDateTimeLocal(event.endsAt, timeZone) : ""
            }
            required
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-max`} required>
            Limite de jogadores
          </Label>
          <Input
            id={`${idPrefix}-max`}
            name="maxPlayers"
            type="number"
            min={2}
            max={200}
            defaultValue={event?.maxPlayers ?? 12}
            required
            inputMode="numeric"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${idPrefix}-payment-mode`} required>
            Tipo de evento
          </Label>
          <Select
            id={`${idPrefix}-payment-mode`}
            name="paymentMode"
            defaultValue={event?.paymentMode ?? "FREE"}
          >
            <option value="FREE">Gratuito</option>
            <option value="PAID">Pago</option>
          </Select>
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-price`}>Valor por jogador (R$)</Label>
          <Input
            id={`${idPrefix}-price`}
            name="price"
            type="number"
            min={0}
            max={10000}
            step="0.01"
            inputMode="decimal"
            defaultValue={event?.priceCents ? (event.priceCents / 100).toFixed(2) : ""}
            placeholder="0,00"
          />
          <p className="mt-1 text-[11px] text-muted">
            Obrigatório para evento pago. Ignorado no gratuito.
          </p>
        </div>
      </div>
      <Switch
        name="autoPaymentReview"
        label="Ativar reconhecimento automático de pagamento via comprovante"
        description="O jogador envia o print do Pix e o sistema tenta validar automaticamente. Se algo divergir, o admin analisa. Só se aplica a eventos pagos."
        defaultChecked={event?.autoPaymentReview ?? false}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${idPrefix}-venue`} required>
            Local
          </Label>
          <Input
            id={`${idPrefix}-venue`}
            name="venueName"
            defaultValue={event?.venueName ?? ""}
            required
            maxLength={90}
            placeholder="Arena, clube ou escola"
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-address`}>Endereço</Label>
          <Input
            id={`${idPrefix}-address`}
            name="address"
            defaultValue={event?.address ?? ""}
            maxLength={160}
            placeholder="Rua, número e quadra"
          />
        </div>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-surface`} required>
          Piso
        </Label>
        <Select
          id={`${idPrefix}-surface`}
          name="surface"
          defaultValue={event?.surface ?? ""}
          required
        >
          <option value="" disabled>
            Selecione areia ou quadra
          </option>
          <option value="COURT">Quadra</option>
          <option value="SAND">Areia</option>
        </Select>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-notes`}>Observações</Label>
        <Textarea
          id={`${idPrefix}-notes`}
          name="notes"
          defaultValue={event?.notes ?? ""}
          maxLength={1000}
          placeholder="Ex.: levar colete, chegar 15 min antes..."
        />
      </div>
    </>
  );
}

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string | string[] }>;
}) {
  const params = await searchParams;
  const editId = typeof params.edit === "string" ? params.edit : undefined;
  const settings = await getSettings();
  const events = await listAllEvents(80);

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-lg font-semibold uppercase tracking-wide text-ink">
              Agendar novo evento
            </p>
            <p className="mt-1 text-sm text-muted">
              A criação agora é feita pelo calendário, escolhendo o dia do jogo.
            </p>
          </div>
          <Link href="/jogos" className={cn(buttonVariants({ variant: "primary", size: "sm" }))}>
            <CalendarDays className="h-4 w-4" aria-hidden />
            Abrir calendário
          </Link>
        </CardBody>
      </Card>

      <div>
        <h2 className="mb-2 font-display text-xl font-semibold uppercase tracking-wide text-ink">Todos os eventos</h2>
        {events.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="h-5 w-5" />}
            title="Nenhum evento criado"
            description="Abra o calendário em Próximos jogos para agendar o primeiro encontro do grupo."
          />
        ) : (
          <div className="space-y-2">
            {events.map((event) => {
              const remaining = Math.max(event.maxPlayers - event.reservedCount, 0);
              return (
                <Card key={event.id}>
                  <CardBody className="space-y-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="font-display text-lg font-semibold uppercase tracking-wide text-ink">
                            {event.title}
                          </p>
                          <SurfaceBadge surface={event.surface} />
                          <Badge
                            tone={
                              event.status === "SCHEDULED"
                                ? "brand"
                                : event.status === "CANCELLED"
                                  ? "danger"
                                  : "neutral"
                            }
                          >
                            {event.status === "SCHEDULED"
                              ? "Agendado"
                              : event.status === "CANCELLED"
                                ? "Cancelado"
                                : "Realizado"}
                          </Badge>
                          <EventPriceBadge paymentMode={event.paymentMode} priceCents={event.priceCents} />
                          {event.autoPaymentReview ? <Badge tone="brand">OCR Pix</Badge> : null}
                          {event.pendingPaymentCount > 0 ? (
                            <Badge tone="warning">{event.pendingPaymentCount} aguardando Pix</Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                          <Clock className="h-3.5 w-3.5" aria-hidden />
                          {toDateTimeLocal(event.startsAt, settings.timezone).replace("T", " · ")}
                          {event.endsAt ? ` – ${formatTime(event.endsAt, settings.timezone)}` : ""}
                        </p>
                        <p className="flex items-center gap-1.5 text-xs text-muted">
                          <MapPin className="h-3.5 w-3.5" aria-hidden />
                          {event.venueName}
                          {event.address ? ` · ${event.address}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-2xl font-bold leading-none text-ink">
                          {event.reservedCount}
                          <span className="text-sm text-muted">/{event.maxPlayers}</span>
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-muted">
                          {event.confirmedCount} confirmados · {event.waitlistCount} na fila
                        </p>
                      </div>
                    </div>

                    <Progress
                      value={event.reservedCount}
                      max={event.maxPlayers}
                      tone={remaining === 0 ? "success" : remaining <= 3 ? "warning" : "brand"}
                    />

                    <div className="flex flex-wrap items-center gap-1.5">
                      <ActionButton
                        action={setEventStatusAction}
                        fields={{ eventId: event.id, status: "CANCELLED" }}
                        variant="danger"
                        size="sm"
                        confirmMessage={`Cancelar o evento "${event.title}"?`}
                        disabled={event.status === "CANCELLED"}
                      >
                        Cancelar
                      </ActionButton>
                      {event.status === "CANCELLED" || event.status === "FINISHED" ? (
                        <ActionButton
                          action={setEventStatusAction}
                          fields={{ eventId: event.id, status: "SCHEDULED" }}
                          variant="secondary"
                          size="sm"
                        >
                          Reabrir
                        </ActionButton>
                      ) : null}
                      <ActionButton
                        action={setEventStatusAction}
                        fields={{ eventId: event.id, status: "FINISHED" }}
                        variant="ghost"
                        size="sm"
                        disabled={event.status === "FINISHED"}
                      >
                        Marcar realizado
                      </ActionButton>
                      {event.publicToken ? (
                        <ShareEventButton token={event.publicToken} title={event.title} />
                      ) : null}
                      <Link
                        href={`/admin/eventos?edit=${event.id}#edit-${event.id}`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                        Editar
                      </Link>
                    </div>

                    <Disclosure
                      id={`edit-${event.id}`}
                      defaultOpen={editId === event.id}
                      className="scroll-mt-24"
                      title="Editar evento"
                      subtitle={`${event.confirmedCount} confirmados · ${event.waitlistCount} na espera`}
                      action={<Briefcase className="h-4 w-4 text-muted" aria-hidden />}
                    >
                      <div className="mb-3 space-y-2">
                        <EventCoverUpload
                          eventId={event.id}
                          hasCover={Boolean(event.coverMime)}
                          version={event.coverUpdatedAt?.getTime() ?? null}
                        />
                      </div>
                      <ActionForm
                        action={updateEventAction}
                        hiddenFields={{ eventId: event.id }}
                        submitLabel="Salvar evento"
                      >
                        <EventFields
                          key={`event-fields-${event.id}-${event.updatedAt.getTime()}`}
                          event={event}
                          timeZone={settings.timezone}
                          idPrefix={`edit-${event.id}`}
                        />
                      </ActionForm>
                      <Alert tone="warning" className="mt-3">
                        Alterar data, local ou limite não remove confirmações existentes. Se o novo limite for menor
                        que o total confirmado, o excesso permanece na lista — ajuste manualmente em Presenças.
                      </Alert>
                    </Disclosure>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <p className="flex items-center justify-center gap-1.5 pb-2 text-[11px] text-muted">
        <Users className="h-3.5 w-3.5" aria-hidden />
        {events.length} eventos no total · fuso {settings.timezone}
      </p>
    </div>
  );
}