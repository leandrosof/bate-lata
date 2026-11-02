"use server";

import { createHash, randomBytes } from "node:crypto";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
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
import { passwordResetEmail, sendEmail, welcomeVerificationEmail } from "@/lib/email";
import { queueEmail } from "@/lib/notify";
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
  verifyEmailSchema,
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

  let verificationToken = "";
  let verificationEmail = "";
  let verificationName = "";
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
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");

    await db.transaction(async (tx) => {
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
          active: false,
        })
        .returning({ id: users.id });

      await tx.insert(emailVerificationTokens).values({
        tokenHash,
        userId: inserted.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        requestedIp: ip,
      });
    });

    verificationToken = token;
    verificationEmail = email;
    verificationName = data.name.trim();
    await ensureBaseData();
  } catch (error) {
    return actionFailure(error);
  }

  try {
    const settings = await getSettings();
    const link = absoluteUrl(`/verificar-email/${verificationToken}`);
    queueEmail({
      to: verificationEmail,
      ...welcomeVerificationEmail({
        name: verificationName,
        siteName: settings.siteName,
        link,
        expiresHours: 24,
      }),
    });
  } catch (error) {
    console.error("[email] falha ao preparar verificação de cadastro", error);
  }

  redirect(`/verificar-email?email=${encodeURIComponent(verificationEmail)}`);
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

  if (!user.emailVerifiedAt) {
    return fail("Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.");
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

export async function resendVerificationAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = requestResetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail(firstZodMessage(parsed.error), zodFieldErrors(parsed.error));
  }

  const email = normalizeEmail(parsed.data.email);
  const { ip } = await requestMeta();
  const perIp = rateLimit(`verify-resend:${ip}`, 10, 60 * 60 * 1000);
  const perEmail = rateLimit(`verify-resend:${email}`, 4, 60 * 60 * 1000);
  if (!perIp.allowed || !perEmail.allowed) {
    return fail("Muitos pedidos. Aguarde alguns minutos e tente novamente.");
  }

  const genericMessage =
    "Se existir um cadastro pendente para este e-mail, enviamos um novo link de confirmação.";

  try {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (user && !user.emailVerifiedAt) {
      const token = randomBytes(32).toString("base64url");
      const tokenHash = createHash("sha256").update(token).digest("hex");

      await db
        .update(emailVerificationTokens)
        .set({ usedAt: new Date() })
        .where(and(eq(emailVerificationTokens.userId, user.id), isNull(emailVerificationTokens.usedAt)));
      await db.insert(emailVerificationTokens).values({
        tokenHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        requestedIp: ip,
      });

      const settings = await getSettings();
      queueEmail({
        to: user.email,
        ...welcomeVerificationEmail({
          name: user.name,
          siteName: settings.siteName,
          link: absoluteUrl(`/verificar-email/${token}`),
          expiresHours: 24,
        }),
      });
    }
  } catch (error) {
    console.error("[email] falha ao reenviar verificação", error);
  }

  return success(genericMessage);
}

export async function verifyEmailAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = verifyEmailSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail(firstZodMessage(parsed.error));
  }

  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  const rows = await db
    .select({ token: emailVerificationTokens, user: users })
    .from(emailVerificationTokens)
    .innerJoin(users, eq(users.id, emailVerificationTokens.userId))
    .where(eq(emailVerificationTokens.tokenHash, tokenHash))
    .limit(1);

  const found = rows[0];
  if (!found || found.token.usedAt || found.token.expiresAt.getTime() < Date.now()) {
    return fail("Este link é inválido ou expirou. Solicite um novo e-mail de confirmação.");
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ emailVerifiedAt: new Date(), active: true, updatedAt: new Date() })
        .where(eq(users.id, found.user.id));
      await tx
        .update(emailVerificationTokens)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(emailVerificationTokens.userId, found.user.id),
            isNull(emailVerificationTokens.usedAt),
          ),
        );
    });
  } catch (error) {
    return actionFailure(error);
  }

  redirect("/entrar?verificado=1");
}
