import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "../client";
import { attendances, drawTeams, draws, gamePlayers, games, rotationCourts, users } from "../schema";
import type { Draw, DrawTeam } from "../schema";

export type RachaPlayerView = {
  attendanceId: string;
  userId: string;
  name: string;
  nickname: string | null;
  avatarUpdatedAt: Date | null;
  rotationStatus: "IDLE" | "WAITING" | "PLAYING" | "LEFT" | "PAUSED";
  queuePosition: number | null;
  gamesPlayed: number;
  checkedInAt: Date | null;
};

export type RachaGamePlayer = {
  userId: string;
  name: string;
};

export type RachaGameView = {
  id: string;
  sequence: number;
  court: number;
  status: "NOT_STARTED" | "IN_PROGRESS" | "FINISHED" | "CANCELLED";
  scoreA: number;
  scoreB: number;
  teamAId: string;
  teamBId: string;
  teamAName: string;
  teamAColor: string;
  teamBName: string;
  teamBColor: string;
  teamAPlayers: RachaGamePlayer[];
  teamBPlayers: RachaGamePlayer[];
  winnerTeamId: string | null;
  canUndo: boolean;
};

export type RachaCourtView = {
  id: string;
  number: number;
  status: "EMPTY" | "WAITING" | "PLAYING";
  game: RachaGameView | null;
};

export type RachaView = {
  session: Draw | null;
  teams: DrawTeam[];
  present: RachaPlayerView[];
  queue: RachaPlayerView[];
  courts: RachaCourtView[];
  currentGame: RachaGameView | null;
  history: RachaGameView[];
  teamSize: number;
  missing: number;
  canUndo: boolean;
  sessionAgeHours: number | null;
};

export async function getRachaView(eventId: string): Promise<RachaView> {
  const [session] = await db
    .select()
    .from(draws)
    .where(and(eq(draws.eventId, eventId), eq(draws.status, "IN_PROGRESS")))
    .orderBy(desc(draws.createdAt))
    .limit(1);

  const presentRows = await db
    .select({
      attendanceId: attendances.id,
      userId: users.id,
      name: users.name,
      nickname: users.nickname,
      avatarUpdatedAt: users.avatarUpdatedAt,
      rotationStatus: attendances.rotationStatus,
      queuePosition: attendances.queuePosition,
      gamesPlayed: attendances.gamesPlayed,
      checkedInAt: attendances.checkedInAt,
    })
    .from(attendances)
    .innerJoin(users, eq(users.id, attendances.userId))
    .where(
      and(
        eq(attendances.eventId, eventId),
        eq(attendances.status, "CONFIRMED"),
        eq(attendances.isOrganizer, false),
        ne(attendances.rotationStatus, "IDLE"),
        eq(users.active, true),
      ),
    )
    .orderBy(asc(attendances.queuePosition), asc(attendances.createdAt));

  const present: RachaPlayerView[] = presentRows;
  const queue = present
    .filter((player) => player.rotationStatus === "WAITING")
    .sort((a, b) => (a.queuePosition ?? 0) - (b.queuePosition ?? 0));

  if (!session) {
    return {
      session: null,
      teams: [],
      present,
      queue,
      courts: [],
      currentGame: null,
      history: [],
      teamSize: 0,
      missing: 0,
      canUndo: false,
      sessionAgeHours: null,
    };
  }

  const teams = await db
    .select()
    .from(drawTeams)
    .where(eq(drawTeams.drawId, session.id))
    .orderBy(asc(drawTeams.sortOrder));

  const gameRows = await db
    .select()
    .from(games)
    .where(eq(games.drawId, session.id))
    .orderBy(asc(games.sequence));

  const gameIds = gameRows.map((game) => game.id);
  const participantRows =
    gameIds.length > 0
      ? await db
          .select({
            gameId: gamePlayers.gameId,
            teamId: gamePlayers.teamId,
            userId: users.id,
            name: users.name,
          })
          .from(gamePlayers)
          .innerJoin(users, eq(users.id, gamePlayers.userId))
          .where(inArray(gamePlayers.gameId, gameIds))
          .orderBy(asc(users.name))
      : [];

  const teamById = new Map(teams.map((team) => [team.id, team]));

  function toView(row: (typeof gameRows)[number]): RachaGameView {
    const participants = participantRows.filter((player) => player.gameId === row.id);
    const teamA = teamById.get(row.teamAId);
    const teamB = teamById.get(row.teamBId);
    const undo = row.undoState as { nextGameId?: string | null } | null;
    const next = undo?.nextGameId
      ? gameRows.find((game) => game.id === undo.nextGameId) ?? null
      : null;

    return {
      id: row.id,
      sequence: row.sequence,
      court: row.court,
      status: row.status,
      scoreA: row.scoreA,
      scoreB: row.scoreB,
      teamAId: row.teamAId,
      teamBId: row.teamBId,
      teamAName: teamA?.name ?? "Lado A",
      teamAColor: teamA?.color ?? "blue",
      teamBName: teamB?.name ?? "Lado B",
      teamBColor: teamB?.color ?? "red",
      teamAPlayers: participants
        .filter((player) => player.teamId === row.teamAId)
        .map((player) => ({ userId: player.userId, name: player.name })),
      teamBPlayers: participants
        .filter((player) => player.teamId === row.teamBId)
        .map((player) => ({ userId: player.userId, name: player.name })),
      winnerTeamId: row.winnerTeamId,
      canUndo:
        row.status === "FINISHED" &&
        Boolean(row.undoState) &&
        (!next || next.status === "NOT_STARTED"),
    };
  }

  const views = gameRows.map(toView);

  const courtRows = await db
    .select()
    .from(rotationCourts)
    .where(eq(rotationCourts.sessionId, session.id))
    .orderBy(asc(rotationCourts.number));

  const activeGames = views
    .filter((game) => game.status === "IN_PROGRESS" || game.status === "NOT_STARTED")
    .sort((a, b) => b.sequence - a.sequence);

  const courts: RachaCourtView[] =
    courtRows.length > 0
      ? courtRows.map((court) => ({
          id: court.id,
          number: court.number,
          status: court.status,
          game:
            activeGames.find(
              (game) => game.court === court.number && game.status === "IN_PROGRESS",
            ) ??
            activeGames.find(
              (game) => game.court === court.number && game.status === "NOT_STARTED",
            ) ??
            null,
        }))
      : [
          {
            id: "legacy",
            number: 1,
            status: activeGames[0] ? "PLAYING" : "EMPTY",
            game: activeGames[0] ?? null,
          },
        ];

  const currentGame = activeGames[0] ?? null;
  const history = views
    .filter((game) => game.status === "FINISHED")
    .sort((a, b) => b.sequence - a.sequence);

  const teamSize = session.teamSize;
  const missing = currentGame ? 0 : Math.max(0, teamSize * 2 - present.filter((p) => p.rotationStatus !== "LEFT").length);

  const latest = history[0] ?? null;

  return {
    session,
    teams,
    present,
    queue,
    courts,
    currentGame,
    history,
    teamSize,
    missing,
    canUndo: latest?.canUndo ?? false,
    sessionAgeHours: session
      ? Math.max(0, Math.floor((Date.now() - session.createdAt.getTime()) / 3600000))
      : null,
  };
}
