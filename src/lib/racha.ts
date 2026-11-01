export type RachaRule = "HYBRID" | "WINNER_STAYS" | "ROTATE_ALL" | "ARRIVAL_QUEUE";

export type RachaPlayer = {
  userId: string;
  gamesPlayed: number;
  queuePosition: number;
  blockId?: string | null;
};

export type RachaLineup = {
  sideA: string[];
  sideB: string[];
  queue: string[];
};

export type RachaPlan =
  | ({ ok: true; winnerStayed: boolean } & RachaLineup)
  | { ok: false; missing: number };

export function orderQueue(
  players: readonly RachaPlayer[],
  rule: RachaRule,
): RachaPlayer[] {
  const copy = [...players];
  if (rule === "ROTATE_ALL") {
    copy.sort(
      (a, b) => a.gamesPlayed - b.gamesPlayed || a.queuePosition - b.queuePosition,
    );
  } else {
    copy.sort(
      (a, b) => a.queuePosition - b.queuePosition || a.gamesPlayed - b.gamesPlayed,
    );
  }
  return copy;
}

export function planFirstMatch(
  players: readonly RachaPlayer[],
  teamSize: number,
  rule: RachaRule,
): RachaPlan {
  const ordered = orderQueue(players, rule);
  const needed = teamSize * 2;
  if (ordered.length < needed) {
    return { ok: false, missing: needed - ordered.length };
  }

  return {
    ok: true,
    winnerStayed: false,
    sideA: ordered.slice(0, teamSize).map((player) => player.userId),
    sideB: ordered.slice(teamSize, needed).map((player) => player.userId),
    queue: ordered.slice(needed).map((player) => player.userId),
  };
}

export function planNextMatch(input: {
  rule: RachaRule;
  teamSize: number;
  players: readonly RachaPlayer[];
  winnerIds: readonly string[];
  loserIds: readonly string[];
}): RachaPlan {
  const { rule, teamSize, players, winnerIds, loserIds } = input;
  const byId = new Map(players.map((player) => [player.userId, player]));
  const winnerSet = new Set(winnerIds);
  const loserSet = new Set(loserIds);

  const waiting = players.filter(
    (player) => !winnerSet.has(player.userId) && !loserSet.has(player.userId),
  );
  const insertion = Math.max(0, ...waiting.map((player) => player.queuePosition));

  const appendedLosers: RachaPlayer[] = loserIds.map((userId, index) => ({
    userId,
    gamesPlayed: byId.get(userId)?.gamesPlayed ?? 0,
    queuePosition: insertion + index + 1,
  }));
  const appendedWinners: RachaPlayer[] = winnerIds.map((userId, index) => ({
    userId,
    gamesPlayed: byId.get(userId)?.gamesPlayed ?? 0,
    queuePosition: insertion + appendedLosers.length + index + 1,
  }));

  const rotateAll =
    rule === "ROTATE_ALL" ||
    rule === "ARRIVAL_QUEUE" ||
    winnerIds.length !== teamSize;

  if (rotateAll) {
    const ordered = orderQueue(
      [...waiting, ...appendedLosers, ...appendedWinners],
      rule,
    );
    const needed = teamSize * 2;
    if (ordered.length < needed) {
      return { ok: false, missing: needed - ordered.length };
    }
    return {
      ok: true,
      winnerStayed: false,
      sideA: ordered.slice(0, teamSize).map((player) => player.userId),
      sideB: ordered.slice(teamSize, needed).map((player) => player.userId),
      queue: ordered.slice(needed).map((player) => player.userId),
    };
  }

  const candidates = [...waiting, ...appendedLosers].sort(
    (a, b) => a.queuePosition - b.queuePosition,
  );
  if (candidates.length < teamSize) {
    return { ok: false, missing: teamSize - candidates.length };
  }

  let opponent: RachaPlayer[] = [];
  const firstBlockId = candidates[0]?.blockId;
  if (firstBlockId) {
    let end = 0;
    while (end < candidates.length && candidates[end].blockId === firstBlockId) end += 1;
    if (end >= teamSize) {
      opponent = candidates.slice(0, teamSize);
    }
  }

  if (opponent.length < teamSize) {
    opponent = orderQueue(candidates, rule).slice(0, teamSize);
  }

  const selected = new Set(opponent.map((player) => player.userId));
  const queue = candidates
    .filter((player) => !selected.has(player.userId))
    .sort((a, b) => a.queuePosition - b.queuePosition)
    .map((player) => player.userId);

  return {
    ok: true,
    winnerStayed: true,
    sideA: [...winnerIds],
    sideB: opponent.map((player) => player.userId),
    queue,
  };
}

export function substitutePlayer(
  lineup: RachaLineup,
  outUserId: string,
  inUserId: string,
): RachaLineup {
  if (!inUserId || outUserId === inUserId) {
    throw new Error("Substituto inválido.");
  }
  if (lineup.sideA.includes(inUserId) || lineup.sideB.includes(inUserId)) {
    throw new Error("O substituto já está em quadra.");
  }
  if (!lineup.queue.includes(inUserId)) {
    throw new Error("O substituto precisa estar na fila de espera.");
  }

  const queue = lineup.queue.filter((id) => id !== inUserId);
  if (lineup.sideA.includes(outUserId)) {
    return {
      sideA: lineup.sideA.map((id) => (id === outUserId ? inUserId : id)),
      sideB: [...lineup.sideB],
      queue,
    };
  }
  if (lineup.sideB.includes(outUserId)) {
    return {
      sideA: [...lineup.sideA],
      sideB: lineup.sideB.map((id) => (id === outUserId ? inUserId : id)),
      queue,
    };
  }
  throw new Error("O jogador não está nesta partida.");
}

export function removeFromQueue(
  queue: readonly string[],
  userId: string,
): string[] {
  return queue.filter((id) => id !== userId);
}
