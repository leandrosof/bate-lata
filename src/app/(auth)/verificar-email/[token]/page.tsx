import Link from "next/link";
import { MailCheck } from "lucide-react";
import { ConfirmEmailForm } from "@/components/forms/confirm-email-form";

export const metadata = { title: "Confirmar e-mail" };

export default async function ConfirmEmailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div className="card p-5 sm:p-7">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <MailCheck className="h-6 w-6" aria-hidden />
      </span>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.2em] text-brand">Confirmação</p>
      <h1 className="mt-1 font-display text-3xl font-semibold uppercase tracking-wide text-ink">
        Ativar minha conta
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Clique no botão para confirmar que este e-mail é seu e liberar o acesso ao site.
      </p>

      <div className="mt-5">
        <ConfirmEmailForm token={token} />
      </div>

      <div className="mt-6 border-t border-line pt-4 text-center text-sm text-muted">
        Link expirado?{" "}
        <Link href="/verificar-email" className="font-semibold text-brand hover:text-ink">
          Reenviar confirmação
        </Link>
      </div>
    </div>
  );
}
