"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, Plus, X } from "lucide-react";
import { createEventAction } from "@/actions/admin";
import { ActionForm } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";

export type CalendarEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  venueName: string;
  address: string | null;
  maxPlayers: number;
  confirmedCount: number;
  waitlistCount: number;
  publicToken: string | null;
  coverMime: string | null;
  coverUpdatedAt: string | null;
};

function dayKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function EventCalendar({
  events,
  isAdmin,
}: {
  events: CalendarEvent[];
  isAdmin: boolean;
}) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date | null>(null);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = dayKey(new Date(event.startsAt));
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const selectedEvents = selected ? (eventsByDay.get(dayKey(selected)) ?? []) : [];
  const defaultDate = selected ? format(selected, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-[#7fa2ff]" aria-hidden />
          <p className="font-display text-lg font-semibold uppercase tracking-wide text-white">
            {format(month, "MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setMonth(subMonths(month, 1))} aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
            Hoje
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setMonth(addMonths(month, 1))} aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-line/70 text-center text-[10px] font-bold uppercase tracking-wider text-muted">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
          <span key={day} className="py-1.5">
            {day}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayEvents = eventsByDay.get(dayKey(day)) ?? [];
          const inMonth = isSameMonth(day, month);
          const today = isToday(day);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => setSelected(day)}
              data-testid={`calendar-day-${dayKey(day)}`}
              className={`min-h-[86px] border-b border-r border-line/50 p-1.5 text-left transition hover:bg-white/[0.04] ${
                inMonth ? "" : "opacity-40"
              }`}
            >
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                  today ? "bg-brand text-white" : "text-muted"
                }`}
              >
                {format(day, "d")}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayEvents.slice(0, 2).map((event) => (
                  <span
                    key={event.id}
                    className="block truncate rounded bg-brand-soft px-1 py-0.5 text-[9px] font-medium text-[#9db8ff]"
                  >
                    {event.title}
                  </span>
                ))}
                {dayEvents.length > 2 ? (
                  <span className="block text-[9px] text-muted">+{dayEvents.length - 2}</span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelected(null)} aria-hidden />
          <div className="relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line-strong bg-[#0b1220] p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#7fa2ff]">Agenda</p>
                <h2 className="font-display text-xl font-semibold uppercase tracking-wide text-white">
                  {format(selected, "EEEE, d 'de' MMMM", { locale: ptBR })}
                </h2>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Fechar" className="rounded-lg p-1 text-muted hover:text-ink">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {selectedEvents.length === 0 ? (
                <p className="text-sm text-muted">Nenhum jogo neste dia.</p>
              ) : (
                selectedEvents.map((event) => (
                  <div key={event.id} className="rounded-xl border border-line/70 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-base font-semibold uppercase tracking-wide text-ink">
                        {event.title}
                      </p>
                      <Badge tone="success">{Math.max(event.maxPlayers - event.confirmedCount, 0)} vagas</Badge>
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                      <Clock className="h-3 w-3" aria-hidden />
                      {format(new Date(event.startsAt), "HH:mm")}
                      {event.endsAt ? ` – ${format(new Date(event.endsAt), "HH:mm")}` : ""}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted">
                      <MapPin className="h-3 w-3" aria-hidden />
                      {event.venueName}
                    </p>
                    {event.publicToken ? (
                      <Link
                        href={`/e/${event.publicToken}`}
                        className="mt-2 inline-block text-xs font-semibold text-[#7fa2ff] hover:text-white"
                      >
                        Ver evento
                      </Link>
                    ) : null}
                  </div>
                ))
              )}
            </div>

            {isAdmin ? (
              <div className="mt-4 border-t border-line pt-3">
                <ActionForm
                  action={createEventAction}
                  submitLabel="Criar evento"
                  pendingLabel="Criando..."
                  variant="primary"
                  size="md"
                  submitIcon={<Plus className="h-4 w-4" aria-hidden />}
                >
                  <div>
                    <Label htmlFor="cal-title" required>
                      Título
                    </Label>
                    <Input id="cal-title" name="title" defaultValue="Vôlei do dia" required maxLength={90} />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="cal-start" required>
                        Início
                      </Label>
                      <Input
                        id="cal-start"
                        name="startsAt"
                        type="datetime-local"
                        defaultValue={`${defaultDate}T19:00`}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="cal-end" required>
                        Fim
                      </Label>
                      <Input
                        id="cal-end"
                        name="endsAt"
                        type="datetime-local"
                        defaultValue={`${defaultDate}T21:00`}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="cal-venue" required>
                        Local
                      </Label>
                      <Input id="cal-venue" name="venueName" required maxLength={90} />
                    </div>
                    <div>
                      <Label htmlFor="cal-max" required>
                        Vagas
                      </Label>
                      <Input id="cal-max" name="maxPlayers" type="number" min={2} max={200} defaultValue={12} required />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="cal-notes">Observações</Label>
                    <Textarea id="cal-notes" name="notes" maxLength={1000} />
                  </div>
                </ActionForm>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
