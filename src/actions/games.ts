"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { games, scoreEvents } from "@/db/schema";
import {
  AppError,
  actionFailure,
  fail,
  firstZodMessage,
  success,
  type ActionState,
  zodFieldErrors,
} from "@/lib/action";
import { recordAudit } from "@/lib/audit";
import { getSessionUser } from "@/lib/session";
import { gameIdSchema, scoreAdjustSchema, scoreSetSchema } from "@/lib/validations";
import { clamp } from "@/lib/utils";

export async function adjustScoreAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = scoreAdjustSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail(firstZodMessage(parsed.error), zodFieldErrors(parsed.error));
  }

  const actor = await getSessionUser();
  if (!actor || actor.role !== "ADMIN") return fail("Ação restrita a administradores.");

  try {
    await db.transaction(async (tx) => {
      const [game] = await tx
        .select()
        .from(games)
        .where(eq(games.id, parsed.data.gameId))
        .for("update")
        .limit(1);
      if (!game) throw new AppError("Partida não encontrada.");
      if (game.status !== "IN_PROGRESS") throw new AppError("Esta partida não está em andamento.");

      const previous = parsed.data.side === "A" ? game.scoreA : game.scoreB;
      const next = clamp(previous + parsed.data.delta, 0, 999);
      const applied = next - previous;
      if (applied === 0) return;

      const scoreA = parsed.data.side === "A" ? next : game.scoreA;
      const scoreB = parsed.data.side === "B" ? next : game.scoreB;

      await tx
        .update(games)
        .set({ scoreA, scoreB, updatedAt: new Date() })
        .where(eq(games.id, game.id));

      await tx.insert(scoreEvents).values({
        gameId: game.id,
        side: parsed.data.side,
        delta: applied,
        scoreA,
        scoreB,
        createdById: actor.id,
        note: "Ajuste de placar",
      });
    });

    revalidatePath("/", "layout");
    return success();
  } catch (error) {
    return actionFailure(error);
  }
}

export async function setScoreAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = scoreSetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail(firstZodMessage(parsed.error), zodFieldErrors(parsed.error));
  }

  const actor = await getSessionUser();
  if (!actor || actor.role !== "ADMIN") return fail("Ação restrita a administradores.");

  try {
    await db.transaction(async (tx) => {
      const [game] = await tx
        .select()
        .from(games)
        .where(eq(games.id, parsed.data.gameId))
        .for("update")
        .limit(1);
      if (!game) throw new AppError("Partida não encontrada.");
      if (game.status !== "IN_PROGRESS") throw new AppError("Esta partida não está em andamento.");

      const scoreA = parsed.data.scoreA;
      const scoreB = parsed.data.scoreB;
      if (scoreA === game.scoreA && scoreB === game.scoreB) return;

      await tx
        .update(games)
        .set({ scoreA, scoreB, updatedAt: new Date() })
        .where(eq(games.id, game.id));

      const entries: { side: "A" | "B"; delta: number }[] = [];
      if (scoreA !== game.scoreA) entries.push({ side: "A", delta: scoreA - game.scoreA });
      if (scoreB !== game.scoreB) entries.push({ side: "B", delta: scoreB - game.scoreB });

      if (entries.length > 0) {
        await tx.insert(scoreEvents).values(
          entries.map((entry) => ({
            gameId: game.id,
            side: entry.side,
            delta: entry.delta,
            scoreA,
            scoreB,
            createdById: actor.id,
            note: "Correção manual do placar",
          })),
        );
      }
    });

    revalidatePath("/", "layout");
    return success("Placar atualizado.");
  } catch (error) {
    return actionFailure(error);
  }
}

export async function finishGameAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = gameIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstZodMessage(parsed.error));

  const actor = await getSessionUser();
  if (!actor || actor.role !== "ADMIN") return fail("Ação restrita a administradores.");

  try {
    const game = await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(games)
        .where(eq(games.id, parsed.data.gameId))
        .for("update")
        .limit(1);
      if (!row) throw new AppError("Partida não encontrada.");
      if (row.status !== "IN_PROGRESS") throw new AppError("Esta partida não está em andamento.");
      if (row.scoreA === row.scoreB) {
        throw new AppError("Empate não é permitido. Corrija o placar antes de encerrar.");
      }

      const winnerTeamId = row.scoreA > row.scoreB ? row.teamAId : row.teamBId;
      const [updated] = await tx
        .update(games)
        .set({
          status: "FINISHED",
          winnerTeamId,
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(games.id, row.id))
        .returning();

      return updated;
    });

    await recordAudit({
      actorId: actor.id,
      action: "game.finish",
      entity: "game",
      entityId: game.id,
      details: {
        scoreA: game.scoreA,
        scoreB: game.scoreB,
        winnerTeamId: game.winnerTeamId,
      },
    });

    revalidatePath("/", "layout");
    return success("Partida encerrada. Resultado registrado no histórico.");
  } catch (error) {
    return actionFailure(error);
  }
}

export async function correctResultAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = scoreSetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail(firstZodMessage(parsed.error), zodFieldErrors(parsed.error));
  }

  const actor = await getSessionUser();
  if (!actor || actor.role !== "ADMIN") return fail("Ação restrita a administradores.");

  try {
    const changes = await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(games)
        .where(eq(games.id, parsed.data.gameId))
        .for("update")
        .limit(1);
      if (!row) throw new AppError("Partida não encontrada.");
      if (row.status !== "FINISHED") {
        throw new AppError("Só é possível corrigir partidas já encerradas.");
      }
      if (parsed.data.scoreA === parsed.data.scoreB) {
        throw new AppError("O placar corrigido não pode terminar empatado.");
      }

      const winnerTeamId =
        parsed.data.scoreA > parsed.data.scoreB ? row.teamAId : row.teamBId;

      await tx
        .update(games)
        .set({
          scoreA: parsed.data.scoreA,
          scoreB: parsed.data.scoreB,
          winnerTeamId,
          updatedAt: new Date(),
        })
        .where(eq(games.id, row.id));

      return {
        before: { scoreA: row.scoreA, scoreB: row.scoreB, winnerTeamId: row.winnerTeamId },
        after: {
          scoreA: parsed.data.scoreA,
          scoreB: parsed.data.scoreB,
          winnerTeamId,
        },
        gameId: row.id,
      };
    });

    await recordAudit({
      actorId: actor.id,
      action: "game.correct",
      entity: "game",
      entityId: changes.gameId,
      details: { before: changes.before, after: changes.after },
    });

    revalidatePath("/", "layout");
    return success("Resultado corrigido e estatísticas recalculadas.");
  } catch (error) {
    return actionFailure(error);
  }
}

export async function cancelGameAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = gameIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstZodMessage(parsed.error));

  const actor = await getSessionUser();
  if (!actor || actor.role !== "ADMIN") return fail("Ação restrita a administradores.");

  try {
    const gameId = await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(games)
        .where(eq(games.id, parsed.data.gameId))
        .for("update")
        .limit(1);
      if (!row) throw new AppError("Partida não encontrada.");
      if (row.status !== "IN_PROGRESS") throw new AppError("Só é possível cancelar partidas em andamento.");

      await tx
        .update(games)
        .set({ status: "CANCELLED", updatedAt: new Date() })
        .where(eq(games.id, row.id));
      return row.id;
    });

    await recordAudit({
      actorId: actor.id,
      action: "game.cancel",
      entity: "game",
      entityId: gameId,
    });

    revalidatePath("/", "layout");
    return success("Partida cancelada. O placar não será contabilizado.");
  } catch (error) {
    return actionFailure(error);
  }
}