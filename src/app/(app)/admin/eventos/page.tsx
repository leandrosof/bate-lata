import { Briefcase, CalendarDays, Clock, MapPin, Users } from "lucide-react";
import { createEventAction, setEventStatusAction, updateEventAction } from "@/actions/admin";
import { ActionButton } from "@/components/ui/action-button";
import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Disclosure } from "@/components/ui/disclosure";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { listAllEvents } from "@/db/queries/events";
import { getSettings } from "@/lib/settings";
import { toDateTimeLocal } from "@/lib/time";
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
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${idPrefix}-starts`} required>
            Data e hora
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

export default async function AdminEventsPage() {
  const settings = await getSettings();
  const events = await listAllEvents(80);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Criar novo evento</CardTitle>
          <Badge tone="brand">Novo</Badge>
        </CardHeader>
        <CardBody className="pt-2">
          <ActionForm
            action={createEventAction}
            submitLabel="Criar evento"
            pendingLabel="Criando..."
            resetOnSuccess
            submitIcon={<CalendarDays className="h-4 w-4" aria-hidden />}
          >
            <EventFields timeZone={settings.timezone} idPrefix="new" />
          </ActionForm>
        </CardBody>
      </Card>

      <div>
        <h2 className="mb-2 font-display text-xl font-semibold uppercase tracking-wide text-ink">Todos os eventos</h2>
        {events.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="h-5 w-5" />}
            title="Nenhum evento criado"
            description="Use o formulário acima para agendar o primeiro encontro do grupo."
          />
        ) : (
          <div className="space-y-2">
            {events.map((event) => {
              const remaining = Math.max(event.maxPlayers - event.confirmedCount, 0);
              return (
                <Card key={event.id}>
                  <CardBody className="space-y-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="font-display text-lg font-semibold uppercase tracking-wide text-white">
                            {event.title}
                          </p>
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
                        </div>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                          <Clock className="h-3.5 w-3.5" aria-hidden />
                          {toDateTimeLocal(event.startsAt, settings.timezone).replace("T", " · ")}
                        </p>
                        <p className="flex items-center gap-1.5 text-xs text-muted">
                          <MapPin className="h-3.5 w-3.5" aria-hidden />
                          {event.venueName}
                          {event.address ? ` · ${event.address}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-2xl font-bold leading-none text-white">
                          {event.confirmedCount}
                          <span className="text-sm text-muted">/{event.maxPlayers}</span>
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-muted">
                          {event.waitlistCount} na fila
                        </p>
                      </div>
                    </div>

                    <Progress
                      value={event.confirmedCount}
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
                      <ActionButton
                        action={setEventStatusAction}
                        fields={{ eventId: event.id, status: "SCHEDULED" }}
                        variant="secondary"
                        size="sm"
                        disabled={event.status === "SCHEDULED"}
                      >
                        Reabrir
                      </ActionButton>
                      <ActionButton
                        action={setEventStatusAction}
                        fields={{ eventId: event.id, status: "FINISHED" }}
                        variant="ghost"
                        size="sm"
                        disabled={event.status === "FINISHED"}
                      >
                        Marcar realizado
                      </ActionButton>

                    </div>

                    <Disclosure
                      title="Editar evento"
                      subtitle={`${event.confirmedCount} confirmados · ${event.waitlistCount} na espera`}
                      action={<Briefcase className="h-4 w-4 text-muted" aria-hidden />}
                    >
                      <ActionForm
                        action={updateEventAction}
                        hiddenFields={{ eventId: event.id }}
                        submitLabel="Salvar evento"
                      >
                        <EventFields event={event} timeZone={settings.timezone} idPrefix={`edit-${event.id}`} />
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
