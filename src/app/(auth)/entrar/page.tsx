import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/forms/login-form";
import { Alert } from "@/components/ui/alert";
import { getSessionUser } from "@/lib/session";

export const metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/inicio");

  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const changed = params.senha === "alterada";

  return (
    <div className="card p-5 sm:p-7">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7fa2ff]">Acesso do jogador</p>
      <h1 className="mt-1 font-display text-3xl font-semibold uppercase tracking-wide text-ink">
        Entrar na arena
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Confirme presença, veja os times sorteados e acompanhe o ranking do grupo.
      </p>

      {changed ? (
        <Alert tone="success" className="mt-4">
          Senha alterada com sucesso. Entre com a nova senha.
        </Alert>
      ) : null}

      <div className="mt-5">
        <LoginForm next={next} />
      </div>

      <div className="mt-6 border-t border-line pt-4 text-center text-sm text-muted">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-semibold text-[#7fa2ff] hover:text-white">
          Criar conta
        </Link>
      </div>
    </div>
  );
}
