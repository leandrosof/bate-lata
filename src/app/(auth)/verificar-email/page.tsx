import Link from "next/link";
import { MailCheck } from "lucide-react";
import { ResendVerificationForm } from "@/components/forms/resend-verification-form";

export const metadata = { title: "Confirmar e-mail" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : "";

  return (
    <div className="card p-5 sm:p-7">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <MailCheck className="h-6 w-6" aria-hidden />
      </span>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.2em] text-brand">Quase lá</p>
      <h1 className="mt-1 font-display text-3xl font-semibold uppercase tracking-wide text-ink">
        Confirme seu e-mail
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Enviamos um link de confirmação{email ? ` para ${email}` : ""}. Abra o e-mail e clique em
        “Confirmar meu e-mail” para ativar sua conta.
      </p>

      <div className="mt-5 rounded-xl border border-line bg-surface-2/50 p-3 text-xs leading-relaxed text-muted">
        Não achou? Confira a caixa de spam ou reenvie o link abaixo. O link expira em 24 horas.
      </div>

      <div className="mt-5">
        <ResendVerificationForm defaultEmail={email} />
      </div>

      <div className="mt-6 border-t border-line pt-4 text-center text-sm text-muted">
        Já confirmou?{" "}
        <Link href="/entrar" className="font-semibold text-brand hover:text-ink">
          Entrar
        </Link>
      </div>
    </div>
  );
}
