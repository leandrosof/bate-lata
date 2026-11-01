import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Página não encontrada" };

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="card w-full max-w-md p-6 text-center sm:p-8">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-[#9db8ff]">
          <SearchX className="h-6 w-6" aria-hidden />
        </span>
        <p className="mt-4 font-display text-5xl font-bold text-white/20">404</p>
        <h1 className="mt-1 font-display text-2xl font-semibold uppercase tracking-wide text-white">
          Página não encontrada
        </h1>
        <p className="mt-2 text-sm text-muted">
          O endereço acessado não existe ou o registro foi removido.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Link href="/inicio" className={cn(buttonVariants({ size: "lg", block: true }))}>
            Ir para o início
          </Link>
          <Link href="/entrar" className={cn(buttonVariants({ variant: "ghost", block: true }))}>
            Entrar na minha conta
          </Link>
        </div>
      </div>
    </div>
  );
}
