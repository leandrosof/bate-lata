import { createHash } from "node:crypto";
import Link from "next/link";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { passwordResetTokens, users } from "@/db/schema";
import { ResetPasswordForm } from "@/components/forms/reset-password-form";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Nova senha" };

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tokenHash = createHash("sha256").update(decodeURIComponent(token)).digest("hex");

  const rows = await db
    .select({ id: passwordResetTokens.id, name: users.name })
    .from(passwordResetTokens)
    .innerJoin(users, eq(users.id, passwordResetTokens.userId))
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const found = rows[0];

  if (!found) {
    return (
      <div className="card p-5 sm:p-7">
        <h1 className="font-display text-3xl font-semibold uppercase tracking-wide text-ink">
          Link inválido
        </h1>
        <Alert tone="danger" className="mt-4">
          Este link de redefinição é inválido, já foi usado ou expirou. Solicite um novo link para continuar.
        </Alert>
        <div className="mt-5 flex flex-col gap-2">
          <Link href="/recuperar-senha" className={cn(buttonVariants({ block: true, size: "lg" }))}>
            Solicitar novo link
          </Link>
          <Link
            href="/entrar"
            className={cn(buttonVariants({ variant: "ghost", block: true }))}
          >
            Voltar para o login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5 sm:p-7">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7fa2ff]">Recuperação</p>
      <h1 className="mt-1 font-display text-3xl font-semibold uppercase tracking-wide text-ink">
        Criar nova senha
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Olá, {found.name.split(" ")[0]}. Escolha uma nova senha para acessar sua conta.
      </p>

      <div className="mt-5">
        <ResetPasswordForm token={decodeURIComponent(token)} />
      </div>

      <div className="mt-6 border-t border-line pt-4 text-center text-sm text-muted">
        <Link href="/entrar" className="font-semibold text-[#7fa2ff] hover:text-white">
          Voltar para o login
        </Link>
      </div>
    </div>
  );
}
