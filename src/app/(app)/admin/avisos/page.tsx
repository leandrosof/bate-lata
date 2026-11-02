import { Megaphone, Pin, Trash2 } from "lucide-react";
import {
  createAnnouncementAction,
  deleteAnnouncementAction,
  updateAnnouncementAction,
} from "@/actions/admin";
import { ActionButton } from "@/components/ui/action-button";
import { ActionForm } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Input, Label, Select, Textarea } from "@/components/ui/input";
import { Disclosure } from "@/components/ui/disclosure";
import { EmptyState } from "@/components/ui/empty-state";
import { listAnnouncements } from "@/db/queries/announcements";
import { listAllEvents } from "@/db/queries/events";
import { getSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Avisos" };

export default async function AdminAnnouncementsPage() {
  const settings = await getSettings();
  const [announcements, events] = await Promise.all([listAnnouncements(50), listAllEvents(60)]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Publicar aviso</CardTitle>
          <Megaphone className="h-4 w-4 text-muted" aria-hidden />
        </CardHeader>
        <CardBody className="pt-2">
          <ActionForm
            action={createAnnouncementAction}
            submitLabel="Publicar aviso"
            resetOnSuccess
            submitIcon={<Megaphone className="h-4 w-4" aria-hidden />}
          >
            <div>
              <Label htmlFor="announcement-title" required>
                Título
              </Label>
              <Input id="announcement-title" name="title" required minLength={3} maxLength={90} placeholder="Ex.: Novo horário" />
            </div>
            <div>
              <Label htmlFor="announcement-body" required>
                Mensagem
              </Label>
              <Textarea
                id="announcement-body"
                name="body"
                required
                minLength={3}
                maxLength={2000}
                className="min-h-28"
                placeholder="Escreva o comunicado para o grupo"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="announcement-event">Vincular a um evento (opcional)</Label>
                <Select id="announcement-event" name="eventId" defaultValue="">
                  <option value="">Sem vínculo</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.title} · {formatDateTime(event.startsAt, settings.timezone)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex items-end">
                <Checkbox name="pinned" label="Fixar no topo" description="Aparece primeiro na página inicial" />
              </div>
            </div>
          </ActionForm>
        </CardBody>
      </Card>

      <section>
        <h2 className="mb-2 font-display text-xl font-semibold uppercase tracking-wide text-ink">
          Avisos publicados
        </h2>
        {announcements.length === 0 ? (
          <EmptyState icon={<Megaphone className="h-5 w-5" />} title="Nenhum aviso publicado" />
        ) : (
          <div className="space-y-2">
            {announcements.map((announcement) => (
              <Card key={announcement.id}>
                <CardBody className="space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-display text-lg font-semibold uppercase tracking-wide text-ink">
                          {announcement.title}
                        </p>
                        {announcement.pinned ? (
                          <Badge tone="warning">
                            <Pin className="h-3 w-3" aria-hidden />
                            Fixado
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-[10px] uppercase tracking-wider text-muted">
                        {formatDateTime(announcement.publishedAt, settings.timezone)}
                        {announcement.authorName ? ` · ${announcement.authorName}` : ""}
                      </p>
                    </div>
                    <ActionButton
                      action={deleteAnnouncementAction}
                      fields={{ announcementId: announcement.id }}
                      variant="danger"
                      size="sm"
                      confirmMessage="Remover este aviso?"
                      icon={<Trash2 className="h-3.5 w-3.5" aria-hidden />}
                    >
                      Remover
                    </ActionButton>
                  </div>
                  <p className="line-clamp-3 whitespace-pre-line text-sm text-ink/85">{announcement.body}</p>
                  <Disclosure title="Editar aviso" subtitle="Alterar título, texto ou fixação">
                    <ActionForm
                      action={updateAnnouncementAction}
                      hiddenFields={{ announcementId: announcement.id }}
                      submitLabel="Salvar aviso"
                    >
                      <div
                        key={`announcement-fields-${announcement.id}-${announcement.title}-${announcement.body}-${announcement.eventId ?? ""}-${announcement.pinned}`}
                        className="space-y-3.5"
                      >
                      <div>
                        <Label htmlFor={`t-${announcement.id}`} required>
                          Título
                        </Label>
                        <Input
                          id={`t-${announcement.id}`}
                          name="title"
                          defaultValue={announcement.title}
                          required
                          maxLength={90}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`b-${announcement.id}`} required>
                          Mensagem
                        </Label>
                        <Textarea
                          id={`b-${announcement.id}`}
                          name="body"
                          defaultValue={announcement.body}
                          className="min-h-28"
                          required
                          maxLength={2000}
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label htmlFor={`e-${announcement.id}`}>Evento vinculado</Label>
                          <Select
                            id={`e-${announcement.id}`}
                            name="eventId"
                            defaultValue={announcement.eventId ?? ""}
                          >
                            <option value="">Sem vínculo</option>
                            {events.map((event) => (
                              <option key={event.id} value={event.id}>
                                {event.title}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div className="flex items-end">
                          <Checkbox
                            name="pinned"
                            label="Fixar no topo"
                            defaultChecked={announcement.pinned}
                          />
                        </div>
                      </div>
                      </div>
                    </ActionForm>
                  </Disclosure>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
