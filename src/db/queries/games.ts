import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../client";
import { drawTeams, events, gamePlayers, games, scoreEvents, users } from "../schema";
import type { Game } from "../schema";

const teamA = alias(drawTeams, "team_a");
const teamB = alias(drawTeams, "team_b");

async function getGameParticipants(gameIds: string[]) {
  if (gameIds.length === 0) return [];
  return db
    .select({
      gameId: gamePlayers.gameId,
      teamId: gamePlayers.teamId,
      userId: users.id,
      name: users.name,
    })
    .from(gamePlayers)
    .innerJoin(users, eq(users.id, gamePlayers.userId))
    .where(inArray(gamePlayers.gameId, gameIds))
    .orderBy(asc(users.name));
}

export type GameWithTeams = Game & {
  eventTitle: string;
  eventStartsAt: Date;
  teamAName: string;
  teamAColor: string;
  teamBName: string;
  teamBColor: string;
  teamAPlayers: { userId: string; name: string }[];
  teamBPlayers: { userId: string; name: string }[];
};

async function hydrate(rows: { game: Game; eventTitle: string; eventStartsAt: Date; teamAName: string; teamAColor: string; teamBName: string; teamBColor: string }[]): Promise<GameWithTeams[]> {
  const gameIds = [...new Set(rows.map((row) => row.game.id))];
  const participants = await getGameParticipants(gameIds);

  return rows.map((row) => {
    const mine = participants.filter((player) => player.gameId === row.game.id);
    return {
      ...row.game,
      eventTitle: row.eventTitle,
      eventStartsAt: row.eventStartsAt,
      teamAName: row.teamAName,
      teamAColor: row.teamAColor,
      teamBName: row.teamBName,
      teamBColor: row.teamBColor,
      teamAPlayers: mine
        .filter((player) => player.teamId === row.game.teamAId)
        .map((player) => ({ userId: player.userId, name: player.name })),
      teamBPlayers: mine
        .filter((player) => player.teamId === row.game.teamBId)
        .map((player) => ({ userId: player.userId, name: player.name })),
    };
  });
}

const baseSelect = {
  game: games,
  eventTitle: events.title,
  eventStartsAt: events.startsAt,
  teamAName: teamA.name,
  teamAColor: teamA.color,
  teamBName: teamB.name,
  teamBColor: teamB.color,
};

function baseQuery() {
  return db
    .select(baseSelect)
    .from(games)
    .innerJoin(events, eq(events.id, games.eventId))
    .innerJoin(teamA, eq(teamA.id, games.teamAId))
    .innerJoin(teamB, eq(teamB.id, games.teamBId));
}

export async function listLiveGames(): Promise<GameWithTeams[]> {
  const rows = await baseQuery()
    .where(eq(games.status, "IN_PROGRESS"))
    .orderBy(desc(games.startedAt));
  return hydrate(rows);
}

export async function listRecentFinishedGames(limit = 10): Promise<GameWithTeams[]> {
  const rows = await baseQuery()
    .where(eq(games.status, "FINISHED"))
    .orderBy(desc(games.finishedAt))
    .limit(limit);
  return hydrate(rows);
}

export async function listFinishedGames(limit = 30, offset = 0): Promise<GameWithTeams[]> {
  const rows = await baseQuery()
    .where(eq(games.status, "FINISHED"))
    .orderBy(desc(games.finishedAt))
    .limit(limit)
    .offset(offset);
  return hydrate(rows);
}

export async function listEventGames(eventId: string): Promise<GameWithTeams[]> {
  const rows = await baseQuery()
    .where(eq(games.eventId, eventId))
    .orderBy(desc(games.createdAt));
  return hydrate(rows);
}

export async function getGameDetail(gameId: string): Promise<{
  game: GameWithTeams;
  scoreLog: { id: string; side: "A" | "B"; delta: number; scoreA: number; scoreB: number; createdAt: Date; authorName: string | null; note: string | null }[];
} | null> {
  const rows = await baseQuery().where(eq(games.id, gameId)).limit(1);
  if (!rows[0]) return null;
  const [game] = await hydrate(rows);

  const log = await db
    .select({
      id: scoreEvents.id,
      side: scoreEvents.side,
      delta: scoreEvents.delta,
      scoreA: scoreEvents.scoreA,
      scoreB: scoreEvents.scoreB,
      createdAt: scoreEvents.createdAt,
      note: scoreEvents.note,
      authorName: users.name,
    })
    .from(scoreEvents)
    .leftJoin(users, eq(users.id, scoreEvents.createdById))
    .where(eq(scoreEvents.gameId, gameId))
    .orderBy(desc(scoreEvents.createdAt))
    .limit(25);

  return { game, scoreLog: log };
}

export async function listPlayerGames(userId: string, limit = 12): Promise<GameWithTeams[]> {
  const mine = await db
    .select({ gameId: gamePlayers.gameId, teamId: gamePlayers.teamId })
    .from(gamePlayers)
    .where(eq(gamePlayers.userId, userId));

  if (mine.length === 0) return [];
  const gameIds = [...new Set(mine.map((row) => row.gameId))];

  const rows = await baseQuery()
    .where(and(eq(games.status, "FINISHED"), inArray(games.id, gameIds)))
    .orderBy(desc(games.finishedAt))
    .limit(limit * 3);

  const filtered = rows.filter((row) => {
    const myTeam = mine.find((entry) => entry.gameId === row.game.id);
    if (!myTeam) return false;
    return row.game.teamAId === myTeam.teamId || row.game.teamBId === myTeam.teamId;
  });

  return (await hydrate(filtered)).slice(0, limit);
}

export async function getGameForScoring(gameId: string) {
  const rows = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  return rows[0] ?? null;
}

export async function getActiveGameForUser(userId: string): Promise<GameWithTeams | null> {
  const mine = await db
    .select({ gameId: gamePlayers.gameId })
    .from(gamePlayers)
    .where(eq(gamePlayers.userId, userId));
  if (mine.length === 0) return null;

  const rows = await baseQuery()
    .where(and(eq(games.status, "IN_PROGRESS"), inArray(games.id, mine.map((row) => row.gameId))))
    .orderBy(desc(games.startedAt))
    .limit(1);

  const hydrated = await hydrate(rows);
  return hydrated[0] ?? null;
}

export async function listDrawGames(drawId: string) {
  return db.select().from(games).where(eq(games.drawId, drawId)).orderBy(desc(games.createdAt));
}

export async function getNextGameForEvent(eventId: string): Promise<GameWithTeams | null> {
  const rows = await baseQuery()
    .where(and(eq(games.eventId, eventId), eq(games.status, "NOT_STARTED")))
    .orderBy(asc(games.sequence), asc(games.createdAt))
    .limit(1);
  const hydrated = await hydrate(rows);
  return hydrated[0] ?? null;
}

