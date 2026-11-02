import Link from "next/link";
import { ResetRequestForm } from "@/components/forms/reset-request-form";

export const metadata = { title: "Recuperar senha" };

export default function ForgotPasswordPage() {
  return (
    <div className="card p-5 sm:p-7">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand">Recuperação</p>
      <h1 className="mt-1 font-display text-3xl font-semibold uppercase tracking-wide text-ink">
        Esqueci a senha
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Informe o e-mail da sua conta. Vamos enviar um link seguro para você criar uma nova senha.
      </p>

      <div className="mt-5">
        <ResetRequestForm />
      </div>

      <div className="mt-6 border-t border-line pt-4 text-center text-sm text-muted">
        Lembrou a senha?{" "}
        <Link href="/entrar" className="font-semibold text-brand hover:text-ink">
          Voltar para o login
        </Link>
      </div>
    </div>
  );
}
