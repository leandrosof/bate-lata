import { MAX_PLAYERS_LIMIT } from "./teams";

export function nextCapacityLimit(
  maxPlayers: number,
  reservedCount: number,
  increment = 1,
): number {
  const base = Math.max(maxPlayers, reservedCount);
  return Math.min(base + Math.max(0, increment), MAX_PLAYERS_LIMIT);
}
