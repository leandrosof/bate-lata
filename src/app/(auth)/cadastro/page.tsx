import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/forms/register-form";
import { Alert } from "@/components/ui/alert";
import { getSessionUser } from "@/lib/session";
import { safeNextPath } from "@/lib/utils";

export const metadata = { title: "Criar conta" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  if (user) redirect(safeNextPath(next));

  return (
    <div className="card p-5 sm:p-7">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand">Novo jogador</p>
      <h1 className="mt-1 font-display text-3xl font-semibold uppercase tracking-wide text-ink">
        Criar minha conta
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Cada jogador tem a própria conta para confirmar presença e acompanhar suas estatísticas.
      </p>

      <Alert tone="info" className="mt-4">
        O <strong>primeiro cadastro</strong> do grupo recebe acesso de administrador. Depois, o admin pode
        promover outros jogadores no painel.
      </Alert>

      <div className="mt-5">
        <RegisterForm next={next} />
      </div>

      <div className="mt-6 border-t border-line pt-4 text-center text-sm text-muted">
        Já tem conta?{" "}
        <Link href={`/entrar${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand hover:text-ink">
          Entrar
        </Link>
      </div>
    </div>
  );
}
