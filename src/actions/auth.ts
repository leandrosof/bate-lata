"use server";

import { createHash, randomBytes } from "node:crypto";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { passwordResetTokens, users } from "@/db/schema";
import {
  AppError,
  actionFailure,
  fail,
  firstZodMessage,
  success,
  type ActionState,
  zodFieldErrors,
} from "@/lib/action";
import { passwordResetEmail, sendEmail } from "@/lib/email";
import { hashPassword, verifyPassword } from "@/lib/password";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { createSession, destroySession, requestMeta, revokeAllSessions } from "@/lib/session";
import { ensureBaseData, getSettings } from "@/lib/settings";
import { absoluteUrl, normalizeEmail, safeNextPath } from "@/lib/utils";
import {
  loginSchema,
  registerSchema,
  requestResetSchema,
  resetPasswordSchema,
} from "@/lib/validations";

let dummyHashPromise: Promise<string> | null = null;
function dummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword("arena-dummy-password");
  return dummyHashPromise;
}

function loginLimitKey(email: string, ip: string) {
  return `login:${ip}:${email}`;
}

export async function registerAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail(firstZodMessage(parsed.error), zodFieldErrors(parsed.error));
  }

  const data = parsed.data;
  const email = normalizeEmail(data.email);
  const { ip } = await requestMeta();
  const limit = rateLimit(`register:${ip}`, 20, 60 * 60 * 1000);
  if (!limit.allowed) {
    return fail("Muitas tentativas de cadastro. Aguarde alguns minutos.");
  }

  let userId = "";
  try {
    if (data.password !== data.confirmPassword) {
      throw new AppError("As senhas não conferem.");
    }

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing[0]) {
      return fail("Este e-mail já está cadastrado.", { email: ["Este e-mail já está cadastrado."] });
    }

    const passwordHash = await hashPassword(data.password);
    const pinnedAdmin = normalizeEmail(process.env.ADMIN_EMAIL ?? "");

    const created = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(690117)`);
      const [row] = await tx.select({ total: count() }).from(users);
      const isFirst = Number(row?.total ?? 0) === 0;
      const role = isFirst || (pinnedAdmin.length > 0 && pinnedAdmin === email) ? "ADMIN" : "PLAYER";
      const [inserted] = await tx
        .insert(users)
        .values({
          name: data.name.trim(),
          email,
          passwordHash,
          role,
        })
        .returning({ id: users.id });
      return inserted;
    });

    userId = created.id;
    await ensureBaseData();
  } catch (error) {
    return actionFailure(error);
  }

  await createSession(userId);
  redirect("/inicio");
}

export async function loginAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail(firstZodMessage(parsed.error), zodFieldErrors(parsed.error));
  }

  const email = normalizeEmail(parsed.data.email);
  const { ip } = await requestMeta();
  const perEmail = rateLimit(loginLimitKey(email, ip), 8, 10 * 60 * 1000);
  if (!perEmail.allowed) {
    return fail("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
  }

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];

  if (!user) {
    await verifyPassword(parsed.data.password, await dummyHash());
    return fail("E-mail ou senha inválidos.");
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    return fail("E-mail ou senha inválidos.");
  }

  if (!user.active) {
    return fail("Sua conta está desativada. Fale com um administrador.");
  }

  resetRateLimit(loginLimitKey(email, ip));
  await createSession(user.id);
  redirect(safeNextPath(parsed.data.next));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/entrar");
}

export async function requestPasswordResetAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = requestResetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail(firstZodMessage(parsed.error), zodFieldErrors(parsed.error));
  }

  const email = normalizeEmail(parsed.data.email);
  const { ip } = await requestMeta();
  const perIp = rateLimit(`reset:${ip}`, 10, 60 * 60 * 1000);
  const perEmail = rateLimit(`reset:${email}`, 4, 60 * 60 * 1000);
  if (!perIp.allowed || !perEmail.allowed) {
    return fail("Muitos pedidos de redefinição. Tente novamente mais tarde.");
  }

  const genericMessage =
    "Se este e-mail estiver cadastrado, enviaremos as instruções para redefinir sua senha.";

  try {
    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = rows[0];
    if (user && user.active) {
      const token = randomBytes(32).toString("base64url");
      const tokenHash = createHash("sha256").update(token).digest("hex");

      await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)));

      await db.insert(passwordResetTokens).values({
        tokenHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        requestedIp: ip,
      });

      const settings = await getSettings();
      const link = absoluteUrl(`/redefinir-senha/${token}`);
      const message = passwordResetEmail({
        name: user.name,
        siteName: settings.siteName,
        link,
      });
      await sendEmail({ to: user.email, ...message });
    }
  } catch (error) {
    console.error("[reset] falha ao processar pedido", error);
    return fail("Não foi possível enviar o e-mail agora. Tente novamente em instantes.");
  }

  return success(genericMessage);
}

export async function resetPasswordAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail(firstZodMessage(parsed.error), zodFieldErrors(parsed.error));
  }

  const { ip } = await requestMeta();
  const limit = rateLimit(`reset-confirm:${ip}`, 10, 60 * 60 * 1000);
  if (!limit.allowed) {
    return fail("Muitos pedidos. Aguarde alguns minutos.");
  }

  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  const rows = await db
    .select({ token: passwordResetTokens, user: users })
    .from(passwordResetTokens)
    .innerJoin(users, eq(users.id, passwordResetTokens.userId))
    .where(eq(passwordResetTokens.tokenHash, tokenHash))
    .limit(1);

  const found = rows[0];
  if (!found || found.token.usedAt || found.token.expiresAt.getTime() < Date.now() || !found.user.active) {
    return fail("Este link é inválido ou expirou. Solicite uma nova redefinição.");
  }

  try {
    const passwordHash = await hashPassword(parsed.data.password);
    await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, found.user.id));
      await tx
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, found.token.id));
    });
    await revokeAllSessions(found.user.id);
  } catch (error) {
    return actionFailure(error);
  }

  redirect("/entrar?senha=alterada");
}
