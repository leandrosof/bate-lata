"use server";

import { randomBytes } from "node:crypto";
import { and, count, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { emailVerificationTokens, passwordResetTokens, users } from "@/db/schema";
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
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, destroySession, getSessionUser, revokeAllSessions } from "@/lib/session";
import {
  changePasswordSchema,
  deleteAccountSchema,
  emailPreferencesSchema,
  updateProfileSchema,
} from "@/lib/validations";

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

export async function updateEmailPreferencesAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getSessionUser();
  if (!actor) return fail("Sua sessão expirou. Entre novamente.");

  const parsed = emailPreferencesSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstZodMessage(parsed.error));

  try {
    await db
      .update(users)
      .set({ emailNotifications: parsed.data.emailNotifications, updatedAt: new Date() })
      .where(eq(users.id, actor.id));

    revalidatePath("/", "layout");
    return success(
      parsed.data.emailNotifications
        ? "Preferência salva: você receberá avisos por e-mail."
        : "Preferência salva: avisos por e-mail desativados.",
    );
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

export async function deleteAccountAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getSessionUser();
  if (!actor) return fail("Sua sessão expirou. Entre novamente.");

  const parsed = deleteAccountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail(firstZodMessage(parsed.error), zodFieldErrors(parsed.error));
  }

  const valid = await verifyPassword(parsed.data.password, actor.passwordHash);
  if (!valid) {
    return fail("Senha incorreta.", { password: ["Senha incorreta."] });
  }

  try {
    if (actor.role === "ADMIN") {
      const [otherAdmins] = await db
        .select({ total: count() })
        .from(users)
        .where(and(eq(users.role, "ADMIN"), eq(users.active, true), ne(users.id, actor.id)));
      if (Number(otherAdmins?.total ?? 0) === 0) {
        throw new AppError(
          "Você é o único administrador ativo. Promova outra pessoa antes de excluir sua conta.",
        );
      }
    }

    const unusablePassword = await hashPassword(randomBytes(32).toString("base64url"));
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          name: "Conta excluída",
          email: `excluido-${actor.id}@bate-lata.invalid`,
          passwordHash: unusablePassword,
          role: "PLAYER",
          nickname: null,
          avatarData: null,
          avatarMime: null,
          avatarOriginalData: null,
          avatarOriginalMime: null,
          avatarUpdatedAt: null,
          emailNotifications: false,
          active: false,
          updatedAt: new Date(),
        })
        .where(eq(users.id, actor.id));

      await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, actor.id));
      await tx.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, actor.id));
    });

    await revokeAllSessions(actor.id);
    await destroySession();
    await recordAudit({
      actorId: actor.id,
      action: "account.delete",
      entity: "user",
      entityId: actor.id,
    });
    revalidatePath("/", "layout");
  } catch (error) {
    return actionFailure(error);
  }

  const { redirect } = await import("next/navigation");
  redirect("/entrar?conta=excluida");
  return null;
}

export async function logoutEverywhereAction(): Promise<void> {
  const actor = await getSessionUser();
  if (!actor) return;
  await revokeAllSessions(actor.id);
  await destroySession();
  const { redirect } = await import("next/navigation");
  redirect("/entrar");
}
