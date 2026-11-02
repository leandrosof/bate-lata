import { TZDate } from "@date-fns/tz";
import { differenceInCalendarDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function parseLocalDateTime(value: string, timeZone: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const parts = { year: Number(year), month: Number(month), day: Number(day), hour: Number(hour), minute: Number(minute) };

  if (
    parts.month < 1 ||
    parts.month > 12 ||
    parts.day < 1 ||
    parts.day > 31 ||
    parts.hour < 0 ||
    parts.hour > 23 ||
    parts.minute < 0 ||
    parts.minute > 59
  ) {
    return null;
  }

  const zoned = new TZDate(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    0,
    0,
    timeZone,
  );
  if (Number.isNaN(zoned.getTime())) return null;

  const normalized = format(zoned, "yyyy-MM-dd'T'HH:mm");
  const expected = `${year}-${month}-${day}T${hour}:${minute}`;
  if (normalized !== expected) return null;

  return new Date(zoned.getTime());
}

export function parseLocalDate(value: string, timeZone: string): Date | null {
  return parseLocalDateTime(`${value.trim()}T00:00`, timeZone);
}

export function toDateTimeLocal(date: Date, timeZone: string): string {
  return format(new TZDate(date, timeZone), "yyyy-MM-dd'T'HH:mm");
}

export function toDateInput(date: Date, timeZone: string): string {
  return format(new TZDate(date, timeZone), "yyyy-MM-dd");
}

export function formatDateTime(date: Date, timeZone: string): string {
  return format(new TZDate(date, timeZone), "EEE, dd 'de' MMMM '·' HH:mm", {
    locale: ptBR,
  });
}

export function formatDateShort(date: Date, timeZone: string): string {
  return format(new TZDate(date, timeZone), "dd/MM/yyyy", { locale: ptBR });
}

export function formatDateLong(date: Date, timeZone: string): string {
  return format(new TZDate(date, timeZone), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

export function formatTime(date: Date, timeZone: string): string {
  return format(new TZDate(date, timeZone), "HH:mm");
}

export function formatDurationSeconds(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return null;
  }

  const totalMinutes = Math.floor(seconds / 60);
  if (totalMinutes < 1) return "menos de 1 min";
  if (totalMinutes < 60) return `${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${String(minutes).padStart(2, "0")}min`;
}

export function formatGameDuration(
  startedAt: Date | null | undefined,
  finishedAt: Date | null | undefined,
  now = new Date(),
): string | null {
  if (!startedAt) return null;
  const end = finishedAt ?? now;
  const seconds = (end.getTime() - startedAt.getTime()) / 1000;
  return formatDurationSeconds(seconds);
}

export function formatWeekday(date: Date, timeZone: string): string {
  return format(new TZDate(date, timeZone), "EEEE", { locale: ptBR });
}

export function formatMonthLabel(monthKey: string, timeZone: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new TZDate(year, month - 1, 1, timeZone);
  return format(date, "MMMM 'de' yyyy", { locale: ptBR });
}

export function currentMonthKey(date: Date, timeZone: string): string {
  return format(new TZDate(date, timeZone), "yyyy-MM");
}

export function monthRange(monthKey: string, timeZone: string): { start: Date; end: Date } {
  const [year, month] = monthKey.split("-").map(Number);
  const start = new TZDate(year, month - 1, 1, timeZone);
  const end = new TZDate(year, month, 1, timeZone);
  return { start: new Date(start.getTime()), end: new Date(end.getTime()) };
}

export function recentMonthKeys(count: number, timeZone: string, reference = new Date()): string[] {
  const base = new TZDate(reference, timeZone);
  const keys: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const date = new TZDate(base.getFullYear(), base.getMonth() - index, 1, timeZone);
    keys.push(format(date, "yyyy-MM"));
  }
  return keys;
}

export function daysUntil(date: Date, timeZone: string, reference = new Date()): number {
  return differenceInCalendarDays(new TZDate(date, timeZone), new TZDate(reference, timeZone));
}

export function countdownLabel(date: Date, timeZone: string): string {
  const days = daysUntil(date, timeZone);
  if (days === 0) return "Hoje";
  if (days === 1) return "Amanhã";
  if (days < 0) return `Há ${Math.abs(days)} dias`;
  return `Em ${days} dias`;
}

export function dayParts(date: Date, timeZone: string) {
  const zoned = new TZDate(date, timeZone);
  return {
    day: format(zoned, "dd"),
    month: format(zoned, "MMM", { locale: ptBR }).replace(".", "").toUpperCase(),
    weekday: format(zoned, "EEE", { locale: ptBR }).replace(".", "").toUpperCase(),
    time: format(zoned, "HH:mm"),
  };
}