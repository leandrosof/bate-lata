import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { closeDatabase, db } from "@/db/client";
import {
  attendances,
  drawTeams,
  draws,
  events,
  gamePlayers,
  games,
  users,
} from "@/db/schema";
import { getEventRoster, getAttendanceMap, listOperationalEvents } from "@/db/queries/events";
import { getPlayerRankingEntry, getRanking } from "@/db/queries/ranking";
import { countGamesPlayed } from "@/db/queries/players";

const tables = [
  "audit_logs",
  "game_substitutions",
  "game_players",
  "score_events",
  "games",
  "draw_teams",
  "draws",
  "announcements",
  "attendances",
  "password_reset_tokens",
  "sessions",
  "events",
  "seasons",
  "settings",
  "users",
];

let anaId = "";
let brunoId = "";
let carlaId = "";
let diegoId = "";
let eventId = "";
let attendanceEventId = "";

beforeAll(async () => {
  await db.execute(sql.raw(`truncate table ${tables.join(", ")} restart identity cascade`));

  const inserted = await db
    .insert(users)
    .values([
      { name: "Ana Souza", email: "ana@test.local", passwordHash: "x" },
      { name: "Bruno Lima", email: "bruno@test.local", passwordHash: "x" },
      { name: "Carla Dias", email: "carla@test.local", passwordHash: "x" },
      { name: "Diego Alves", email: "diego@test.local", passwordHash: "x", active: false },
    ])
    .returning({ id: users.id, email: users.email });

  anaId = inserted.find((row) => row.email === "ana@test.local")!.id;
  brunoId = inserted.find((row) => row.email === "bruno@test.local")!.id;
  carlaId = inserted.find((row) => row.email === "carla@test.local")!.id;
  diegoId = inserted.find((row) => row.email === "diego@test.local")!.id;

  const [event] = await db
    .insert(events)
    .values({
      title: "Evento histórico",
      startsAt: new Date("2026-02-10T22:00:00.000Z"),
      venueName: "Arena",
      maxPlayers: 12,
      status: "FINISHED",
      createdById: anaId,
    })
    .returning({ id: events.id });
  eventId = event.id;

  const [draw] = await db
    .insert(draws)
    .values({
      eventId,
      teamSize: 2,
      status: "FINISHED",
      createdById: anaId,
      finishedAt: new Date("2026-02-10T23:30:00.000Z"),
    })
    .returning({ id: draws.id });

  const [teamA] = await db
    .insert(drawTeams)
    .values({ drawId: draw.id, name: "Azul", color: "blue", sortOrder: 0 })
    .returning({ id: drawTeams.id });
  const [teamB] = await db
    .insert(drawTeams)
    .values({ drawId: draw.id, name: "Vermelho", color: "red", sortOrder: 1 })
    .returning({ id: drawTeams.id });

  const insertedGames = await db
    .insert(games)
    .values([
      {
        drawId: draw.id,
        eventId,
        teamAId: teamA.id,
        teamBId: teamB.id,
        status: "FINISHED",
        scoreA: 25,
        scoreB: 20,
        winnerTeamId: teamA.id,
        startedAt: new Date("2026-01-10T18:00:00.000Z"),
        finishedAt: new Date("2026-01-10T18:40:00.000Z"),
        createdById: anaId,
      },
      {
        drawId: draw.id,
        eventId,
        teamAId: teamA.id,
        teamBId: teamB.id,
        status: "FINISHED",
        scoreA: 21,
        scoreB: 25,
        winnerTeamId: teamB.id,
        startedAt: new Date("2026-02-10T18:00:00.000Z"),
        finishedAt: new Date("2026-02-10T18:40:00.000Z"),
        createdById: anaId,
      },
      {
        drawId: draw.id,
        eventId,
        teamAId: teamA.id,
        teamBId: teamB.id,
        status: "IN_PROGRESS",
        scoreA: 10,
        scoreB: 5,
        startedAt: new Date("2026-03-01T18:00:00.000Z"),
        createdById: anaId,
      },
    ])
    .returning({ id: games.id });

  await db.insert(gamePlayers).values(
    insertedGames.flatMap((game) => [
      { gameId: game.id, teamId: teamA.id, userId: anaId },
      { gameId: game.id, teamId: teamA.id, userId: brunoId },
      { gameId: game.id, teamId: teamB.id, userId: carlaId },
    ]),
  );

  const [attendanceEvent] = await db
    .insert(events)
    .values({
      title: "Próximo encontro",
      startsAt: new Date("2026-12-05T22:00:00.000Z"),
      venueName: "Arena",
      maxPlayers: 2,
      createdById: anaId,
    })
    .returning({ id: events.id });
  attendanceEventId = attendanceEvent.id;

  await db.insert(attendances).values([
    {
      eventId: attendanceEventId,
      userId: anaId,
      status: "CONFIRMED",
      createdAt: new Date("2026-11-01T10:00:00.000Z"),
    },
    {
      eventId: attendanceEventId,
      userId: brunoId,
      status: "WAITLIST",
      waitlistPosition: 1,
      createdAt: new Date("2026-11-01T11:00:00.000Z"),
    },
    {
      eventId: attendanceEventId,
      userId: carlaId,
      status: "CANCELLED",
      createdAt: new Date("2026-11-01T12:00:00.000Z"),
    },
  ]);
});

afterAll(async () => {
  await closeDatabase();
});

describe("getRanking", () => {
  it("calcula partidas, vitórias, derrotas, aproveitamento e pontos", async () => {
    const ranking = await getRanking({ from: null, to: null }, 3, 1);

    expect(ranking).toHaveLength(3);
    const ana = ranking.find((entry) => entry.userId === anaId)!;
    expect(ana.played).toBe(2);
    expect(ana.wins).toBe(1);
    expect(ana.losses).toBe(1);
    expect(ana.winRate).toBe(50);
    expect(ana.points).toBe(4);
    expect(ana.position).toBe(1);

    const carla = ranking.find((entry) => entry.userId === carlaId)!;
    expect(carla.played).toBe(2);
    expect(carla.wins).toBe(1);
    expect(carla.points).toBe(4);
    expect(carla.position).toBe(3);
  });

  it("não contabiliza partidas em andamento", async () => {
    const ranking = await getRanking({ from: null, to: null }, 3, 1);
    ranking.forEach((entry) => expect(entry.played).toBe(2));
    expect(await countGamesPlayed()).toBe(2);
  });

  it("filtra por período (ranking mensal)", async () => {
    const ranking = await getRanking(
      { from: new Date("2026-01-01T00:00:00.000Z"), to: new Date("2026-02-01T00:00:00.000Z") },
      3,
      1,
    );

    const ana = ranking.find((entry) => entry.userId === anaId)!;
    expect(ana.played).toBe(1);
    expect(ana.wins).toBe(1);
    expect(ana.points).toBe(3);
    expect(ana.winRate).toBe(100);

    const carla = ranking.find((entry) => entry.userId === carlaId)!;
    expect(carla.points).toBe(1);
  });

  it("respeita a pontuação configurada", async () => {
    const ranking = await getRanking({ from: null, to: null }, 10, 0);
    const ana = ranking.find((entry) => entry.userId === anaId)!;
    expect(ana.points).toBe(10);
  });

  it("retorna a posição individual", async () => {
    const result = await getPlayerRankingEntry(anaId, { from: null, to: null }, 3, 1);
    expect(result.totalPlayers).toBe(3);
    expect(result.entry?.position).toBe(1);
    expect(result.entry?.points).toBe(4);
  });
});

describe("lista de presença", () => {
  it("separa confirmados, fila e pendentes", async () => {
    const roster = await getEventRoster(attendanceEventId);

    expect(roster.confirmed.map((row) => row.userId)).toEqual([anaId]);
    expect(roster.waitlist.map((row) => row.userId)).toEqual([brunoId]);
    expect(roster.waitlist[0].waitlistPosition).toBe(1);
    expect(roster.pending.map((row) => row.userId)).toContain(carlaId);
    expect(roster.pending.map((row) => row.userId)).not.toContain(diegoId);
    expect(diegoId).toBeTruthy();
  });

  it("retorna o status do jogador por evento", async () => {
    const map = await getAttendanceMap(brunoId);
    expect(map.get(attendanceEventId)?.status).toBe("WAITLIST");
    expect(map.get(attendanceEventId)?.waitlistPosition).toBe(1);
  });
});

describe("lista operacional de eventos", () => {
  it("inclui evento antigo que ainda tem partida em andamento", async () => {
    const events = await listOperationalEvents();

    const active = events.find((event) => event.id === eventId);
    expect(active?.active).toBe(true);
    expect(active?.activeSessionStartedAt).toBeTruthy();

    const upcoming = events.find((event) => event.id === attendanceEventId);
    expect(upcoming?.active).toBe(false);
  });
});
