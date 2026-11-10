import { and, asc, count, desc, eq, gte, inArray, isNotNull } from "drizzle-orm";
import { db } from "../client";
import { attendances, draws, events, games, paymentProofs, users } from "../schema";
import type { EventRow } from "../schema";

export type RosterPlayer = {
  attendanceId: string;
  userId: string;
  name: string;
  nickname: string | null;
  avatarUpdatedAt: Date | null;
  status: "PENDING_PAYMENT" | "CONFIRMED" | "WAITLIST" | "CANCELLED";
  waitlistPosition: number | null;
  rotationStatus: "IDLE" | "WAITING" | "PLAYING" | "LEFT" | "PAUSED";
  checkedInAt: Date | null;
  queuePosition: number | null;
  gamesPlayed: number;
  isOrganizer: boolean;
  since: Date;
  paymentProofId: string | null;
  paymentProofStatus: "PROCESSING" | "NEEDS_REVIEW" | "APPROVED" | "REJECTED" | null;
  paymentProofNote: string | null;
  paymentProofImageBytes: number | null;
  paymentProofImageDeletedAt: Date | null;
};

export type EventSummary = EventRow & {
  confirmedCount: number;
  checkedInCount: number;
  pendingPaymentCount: number;
  reservedCount: number;
  waitlistCount: number;
};

export type OperationalEvent = EventSummary & {
  active: boolean;
  activeSessionStartedAt: Date | null;
  activeHours: number;
};

async function attachCounts(rows: EventRow[]): Promise<EventSummary[]> {
  if (rows.length === 0) return [];
  const counts = await db
    .select({
      eventId: attendances.eventId,
      status: attendances.status,
      total: count(),
      checkedIn: count(attendances.checkedInAt),
    })
    .from(attendances)
    .where(eq(attendances.isOrganizer, false))
    .groupBy(attendances.eventId, attendances.status);

  return rows.map((event) => {
    const confirmedCount = counts
      .filter((row) => row.eventId === event.id && row.status === "CONFIRMED")
      .reduce((total, row) => total + Number(row.total), 0);
    const checkedInCount = counts
      .filter((row) => row.eventId === event.id && row.status === "CONFIRMED")
      .reduce((total, row) => total + Number(row.checkedIn), 0);
    const pendingPaymentCount = counts
      .filter((row) => row.eventId === event.id && row.status === "PENDING_PAYMENT")
      .reduce((total, row) => total + Number(row.total), 0);
    const waitlistCount = counts
      .filter((row) => row.eventId === event.id && row.status === "WAITLIST")
      .reduce((total, row) => total + Number(row.total), 0);
    return {
      ...event,
      confirmedCount,
      checkedInCount,
      pendingPaymentCount,
      reservedCount: confirmedCount + pendingPaymentCount,
      waitlistCount,
    };
  });
}

export async function getEventById(eventId: string): Promise<EventSummary | null> {
  const rows = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!rows[0]) return null;
  const [summary] = await attachCounts(rows);
  return summary;
}

export async function getEventByPublicToken(token: string): Promise<EventSummary | null> {
  const rows = await db.select().from(events).where(eq(events.publicToken, token)).limit(1);
  if (!rows[0]) return null;
  const [summary] = await attachCounts(rows);
  return summary;
}

export async function getNextEvent(reference = new Date()): Promise<EventSummary | null> {
  const threshold = new Date(reference.getTime() - 1000 * 60 * 60 * 6);
  const rows = await db
    .select()
    .from(events)
    .where(and(eq(events.status, "SCHEDULED"), gte(events.startsAt, threshold)))
    .orderBy(asc(events.startsAt))
    .limit(1);
  const [summary] = await attachCounts(rows);
  return summary ?? null;
}

export async function listUpcomingEvents(reference = new Date()): Promise<EventSummary[]> {
  const threshold = new Date(reference.getTime() - 1000 * 60 * 60 * 6);
  const rows = await db
    .select()
    .from(events)
    .where(and(eq(events.status, "SCHEDULED"), gte(events.startsAt, threshold)))
    .orderBy(asc(events.startsAt));
  return attachCounts(rows);
}

export async function listEventsByStatus(
  status: EventRow["status"],
  limit = 80,
): Promise<EventSummary[]> {
  const rows = await db
    .select()
    .from(events)
    .where(eq(events.status, status))
    .orderBy(desc(events.startsAt))
    .limit(limit);
  return attachCounts(rows);
}

export async function countEventsByStatus(): Promise<{
  scheduled: number;
  finished: number;
  cancelled: number;
}> {
  const rows = await db
    .select({ status: events.status, total: count() })
    .from(events)
    .groupBy(events.status);
  const totalFor = (status: EventRow["status"]) =>
    Number(rows.find((row) => row.status === status)?.total ?? 0);
  return {
    scheduled: totalFor("SCHEDULED"),
    finished: totalFor("FINISHED"),
    cancelled: totalFor("CANCELLED"),
  };
}

export async function listFinishedPublicEvents(limit = 80): Promise<EventSummary[]> {
  const rows = await db
    .select()
    .from(events)
    .where(and(eq(events.status, "FINISHED"), isNotNull(events.publicToken)))
    .orderBy(desc(events.startsAt))
    .limit(limit);
  return attachCounts(rows);
}

export async function listOperationalEvents(reference = new Date()): Promise<OperationalEvent[]> {
  const upcoming = await listUpcomingEvents(reference);

  const activeDraws = await db
    .select({ eventId: draws.eventId, startedAt: draws.createdAt })
    .from(draws)
    .where(eq(draws.status, "IN_PROGRESS"))
    .orderBy(desc(draws.createdAt));

  const liveGames = await db
    .select({
      eventId: games.eventId,
      startedAt: games.startedAt,
      createdAt: games.createdAt,
    })
    .from(games)
    .where(eq(games.status, "IN_PROGRESS"));

  const activeStartedAt = new Map<string, Date>();
  for (const row of activeDraws) {
    if (!activeStartedAt.has(row.eventId)) activeStartedAt.set(row.eventId, row.startedAt);
  }
  for (const row of liveGames) {
    if (!activeStartedAt.has(row.eventId)) {
      activeStartedAt.set(row.eventId, row.startedAt ?? row.createdAt);
    }
  }

  const upcomingIds = new Set(upcoming.map((event) => event.id));
  const missingIds = [...activeStartedAt.keys()].filter((id) => !upcomingIds.has(id));
  const extraRows =
    missingIds.length > 0
      ? await db.select().from(events).where(inArray(events.id, missingIds))
      : [];
  const extra = await attachCounts(extraRows);

  const combined: OperationalEvent[] = [
    ...upcoming.map((event) => ({
      ...event,
      active: activeStartedAt.has(event.id),
      activeSessionStartedAt: activeStartedAt.get(event.id) ?? null,
      activeHours: activeStartedAt.get(event.id)
        ? Math.max(
            0,
            Math.floor((reference.getTime() - activeStartedAt.get(event.id)!.getTime()) / 3600000),
          )
        : 0,
    })),
    ...extra.map((event) => ({
      ...event,
      active: true,
      activeSessionStartedAt: activeStartedAt.get(event.id) ?? null,
      activeHours: activeStartedAt.get(event.id)
        ? Math.max(
            0,
            Math.floor((reference.getTime() - activeStartedAt.get(event.id)!.getTime()) / 3600000),
          )
        : 0,
    })),
  ];

  combined.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.startsAt.getTime() - b.startsAt.getTime();
  });

  return combined;
}

export async function getActiveOperationalEvent(
  reference = new Date(),
): Promise<OperationalEvent | null> {
  const events = await listOperationalEvents(reference);
  return events.find((event) => event.active) ?? null;
}

export async function listRecentEvents(limit = 6): Promise<EventSummary[]> {
  const rows = await db.select().from(events).orderBy(desc(events.startsAt)).limit(limit);
  return attachCounts(rows);
}

export async function listAllEvents(limit = 80): Promise<EventSummary[]> {
  const rows = await db.select().from(events).orderBy(desc(events.startsAt)).limit(limit);
  return attachCounts(rows);
}

export async function getEventRoster(eventId: string): Promise<{
  confirmed: RosterPlayer[];
  pendingPayment: RosterPlayer[];
  organizers: RosterPlayer[];
  waitlist: RosterPlayer[];
  pending: { userId: string; name: string; nickname: string | null; avatarUpdatedAt: Date | null }[];
  cancelled: RosterPlayer[];
}> {
  const rows = await db
    .select({
      attendanceId: attendances.id,
      userId: users.id,
      name: users.name,
      nickname: users.nickname,
      avatarUpdatedAt: users.avatarUpdatedAt,
      status: attendances.status,
      waitlistPosition: attendances.waitlistPosition,
      rotationStatus: attendances.rotationStatus,
      checkedInAt: attendances.checkedInAt,
      queuePosition: attendances.queuePosition,
      gamesPlayed: attendances.gamesPlayed,
      isOrganizer: attendances.isOrganizer,
      since: attendances.createdAt,
      paymentProofId: paymentProofs.id,
      paymentProofStatus: paymentProofs.status,
      paymentProofNote: paymentProofs.note,
      paymentProofImageBytes: paymentProofs.imageBytes,
      paymentProofImageDeletedAt: paymentProofs.imageDeletedAt,
    })
    .from(attendances)
    .innerJoin(users, eq(users.id, attendances.userId))
    .leftJoin(paymentProofs, eq(paymentProofs.attendanceId, attendances.id))
    .where(eq(attendances.eventId, eventId))
    .orderBy(asc(attendances.waitlistPosition), asc(attendances.createdAt));

  const confirmed = rows
    .filter((row) => row.status === "CONFIRMED" && !row.isOrganizer)
    .sort((a, b) => a.since.getTime() - b.since.getTime());
  const pendingPayment = rows
    .filter((row) => row.status === "PENDING_PAYMENT" && !row.isOrganizer)
    .sort((a, b) => a.since.getTime() - b.since.getTime());
  const organizers = rows
    .filter((row) => row.status === "CONFIRMED" && row.isOrganizer)
    .sort((a, b) => a.since.getTime() - b.since.getTime());
  const waitlist = rows
    .filter((row) => row.status === "WAITLIST")
    .sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0));
  const cancelled = rows.filter((row) => row.status === "CANCELLED");

  const listed = new Set(rows.filter((row) => row.status !== "CANCELLED").map((row) => row.userId));
  const activeUsers = await db
    .select({
      userId: users.id,
      name: users.name,
      nickname: users.nickname,
      avatarUpdatedAt: users.avatarUpdatedAt,
    })
    .from(users)
    .where(and(eq(users.active, true), eq(users.role, "PLAYER")))
    .orderBy(asc(users.name));

  const pending = activeUsers.filter((user) => !listed.has(user.userId));

  return { confirmed, pendingPayment, organizers, waitlist, pending, cancelled };
}

export async function listConfirmedPlayers(eventId: string) {
  return db
    .select({
      userId: users.id,
      name: users.name,
      nickname: users.nickname,
      avatarUpdatedAt: users.avatarUpdatedAt,
    })
    .from(attendances)
    .innerJoin(users, eq(users.id, attendances.userId))
    .where(
      and(
        eq(attendances.eventId, eventId),
        eq(attendances.status, "CONFIRMED"),
        eq(attendances.isOrganizer, false),
        eq(users.active, true),
      ),
    )
    .orderBy(asc(users.name));
}

export async function listConfirmedCount(eventId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(attendances)
    .where(and(eq(attendances.eventId, eventId), eq(attendances.status, "CONFIRMED"), eq(attendances.isOrganizer, false)));
  return Number(row?.total ?? 0);
}

export async function getAttendanceMap(userId: string) {
  const rows = await db
    .select({
      attendanceId: attendances.id,
      eventId: attendances.eventId,
      status: attendances.status,
      waitlistPosition: attendances.waitlistPosition,
      isOrganizer: attendances.isOrganizer,
      paymentProofId: paymentProofs.id,
      paymentProofStatus: paymentProofs.status,
      paymentProofNote: paymentProofs.note,
    })
    .from(attendances)
    .leftJoin(paymentProofs, eq(paymentProofs.attendanceId, attendances.id))
    .where(eq(attendances.userId, userId));

  return new Map(rows.map((row) => [row.eventId, row]));
}