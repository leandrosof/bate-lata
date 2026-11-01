"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import {
  AppError,
  actionFailure,
  fail,
  firstZodMessage,
  success,
  type ActionState,
  zodFieldErrors,
} from "@/lib/action";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, destroySession, getSessionUser, revokeAllSessions } from "@/lib/session";
import { changePasswordSchema, updateProfileSchema } from "@/lib/validations";

export async function updateProfileAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getSessionUser();
  if (!actor) return fail("Sua sessão expirou. Entre novamente.");

  const parsed = updateProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstZodMessage(parsed.error), zodFieldErrors(parsed.error));

  try {
    await db
      .update(users)
      .set({
        name: parsed.data.name.trim(),
        nickname: parsed.data.nickname?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, actor.id));

    revalidatePath("/", "layout");
    return success("Perfil atualizado.");
  } catch (error) {
    return actionFailure(error);
  }
}

export async function changePasswordAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getSessionUser();
  if (!actor) return fail("Sua sessão expirou. Entre novamente.");

  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstZodMessage(parsed.error), zodFieldErrors(parsed.error));

  try {
    const valid = await verifyPassword(parsed.data.currentPassword, actor.passwordHash);
    if (!valid) {
      return fail("Senha atual incorreta.", { currentPassword: ["Senha atual incorreta."] });
    }
    if (parsed.data.currentPassword === parsed.data.password) {
      throw new AppError("A nova senha deve ser diferente da atual.");
    }

    const passwordHash = await hashPassword(parsed.data.password);
    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, actor.id));

    await revokeAllSessions(actor.id);
    await createSession(actor.id);

    revalidatePath("/", "layout");
    return success("Senha alterada. Outros dispositivos foram desconectados.");
  } catch (error) {
    return actionFailure(error);
  }
}

export async function removeAvatarAction(): Promise<ActionState> {
  const actor = await getSessionUser();
  if (!actor) return fail("Sua sessão expirou. Entre novamente.");

  try {
    await db
      .update(users)
      .set({ avatarData: null, avatarMime: null, avatarUpdatedAt: null, updatedAt: new Date() })
      .where(eq(users.id, actor.id));
    revalidatePath("/", "layout");
    return success("Foto removida.");
  } catch (error) {
    return actionFailure(error);
  }
}

export async function deleteAccountAction(): Promise<ActionState> {
  const actor = await getSessionUser();
  if (!actor) return fail("Sua sessão expirou. Entre novamente.");
  return fail(
    "Para excluir sua conta, peça a um administrador para desativar seu acesso. O histórico do grupo é preservado.",
  );
}

export async function logoutEverywhereAction(): Promise<void> {
  const actor = await getSessionUser();
  if (!actor) return;
  await revokeAllSessions(actor.id);
  await destroySession();
  const { redirect } = await import("next/navigation");
  redirect("/entrar");
}
