import { randomInt } from "node:crypto";
import { TEAM_SIZE_OPTIONS, teamVisualForIndex } from "./teams";

export class DrawError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DrawError";
  }
}

export type DrawPlayer = { id: string; name: string };

export type GeneratedTeam = {
  name: string;
  color: string;
  players: DrawPlayer[];
};

export type DrawOutcome = {
  teams: GeneratedTeam[];
  reserves: DrawPlayer[];
  teamSize: number;
  teamCount: number;
};

type RandomIntFn = (maxExclusive: number) => number;

export function shuffle<T>(items: readonly T[], randomIntFn: RandomIntFn = (max) => randomInt(max)): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapWith = randomIntFn(index + 1);
    [result[index], result[swapWith]] = [result[swapWith], result[index]];
  }
  return result;
}

export function isTeamSize(value: number): value is (typeof TEAM_SIZE_OPTIONS)[number] {
  return (TEAM_SIZE_OPTIONS as readonly number[]).includes(value);
}

export function generateTeams(input: {
  players: DrawPlayer[];
  teamSize: number;
  prioritize?: string[];
  randomIntFn?: RandomIntFn;
}): DrawOutcome {
  const { teamSize } = input;
  if (!isTeamSize(teamSize)) {
    throw new DrawError("A quantidade de jogadores por time deve ser 4, 5 ou 6.");
  }

  const unique = new Map<string, DrawPlayer>();
  for (const player of input.players) {
    if (!player.id || unique.has(player.id)) continue;
    unique.set(player.id, { id: player.id, name: player.name });
  }

  const players = [...unique.values()];
  const teamCount = Math.floor(players.length / teamSize);
  if (teamCount < 2) {
    throw new DrawError(
      `São necessários pelo menos ${teamSize * 2} jogadores confirmados para formar 2 times de ${teamSize}. ` +
        `Há ${players.length} confirmado(s).`,
    );
  }

  const priorityIds = new Set(input.prioritize ?? []);
  const priority: DrawPlayer[] = [];
  const rest: DrawPlayer[] = [];
  for (const player of players) {
    if (priorityIds.has(player.id)) priority.push(player);
    else rest.push(player);
  }

  const ordered = [...shuffle(priority, input.randomIntFn), ...shuffle(rest, input.randomIntFn)];
  const eligibleCount = teamCount * teamSize;
  const eligible = ordered.slice(0, eligibleCount);
  const reserves = ordered.slice(eligibleCount);

  const teams: GeneratedTeam[] = Array.from({ length: teamCount }, (_, index) => {
    const visual = teamVisualForIndex(index);
    return { name: visual.name, color: visual.color, players: [] };
  });

  eligible.forEach((player, index) => {
    teams[index % teamCount].players.push(player);
  });

  return { teams, reserves, teamSize, teamCount };
}

export function describeDraw(outcome: DrawOutcome): string {
  const teamLabel = outcome.teamCount === 1 ? "time" : "times";
  const reserveLabel = outcome.reserves.length === 1 ? "reserva" : "reservas";
  return `${outcome.teamCount} ${teamLabel} de ${outcome.teamSize} · ${outcome.reserves.length} ${reserveLabel} na fila`;
}
