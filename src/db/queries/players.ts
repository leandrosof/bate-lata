import { asc, count, eq } from "drizzle-orm";
import { db } from "../client";
import { games, users } from "../schema";
import { getRanking } from "./ranking";

export async function listAllPlayers() {
  return db
    .select({
      id: users.id,
      name: users.name,
      nickname: users.nickname,
      email: users.email,
      role: users.role,
      active: users.active,
      emailVerifiedAt: users.emailVerifiedAt,
      emailNotifications: users.emailNotifications,
      avatarUpdatedAt: users.avatarUpdatedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.name));
}

export async function listPlayersWithStats(pointsWin = 3, pointsLoss = 1) {
  const players = await db
    .select({
      id: users.id,
      name: users.name,
      nickname: users.nickname,
      avatarUpdatedAt: users.avatarUpdatedAt,
    })
    .from(users)
    .where(eq(users.active, true))
    .orderBy(asc(users.name));

  const ranking = await getRanking({ from: null, to: null }, pointsWin, pointsLoss);
  const byUser = new Map(ranking.map((entry) => [entry.userId, entry]));

  return players.map((player) => {
    const stats = byUser.get(player.id);
    return {
      ...player,
      played: stats?.played ?? 0,
      wins: stats?.wins ?? 0,
      winRate: stats?.winRate ?? 0,
      points: stats?.points ?? 0,
      position: stats?.position ?? null,
    };
  });
}

export async function getPublicPlayer(userId: string) {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      nickname: users.nickname,
      role: users.role,
      active: users.active,
      avatarUpdatedAt: users.avatarUpdatedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function countGamesPlayed(): Promise<number> {
  const [row] = await db.select({ total: count() }).from(games).where(eq(games.status, "FINISHED"));
  return Number(row?.total ?? 0);
}
