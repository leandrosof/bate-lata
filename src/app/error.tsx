"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="card w-full max-w-md p-6 text-center sm:p-8">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(240,82,82,0.12)] text-[#ff9a9a]">
          <TriangleAlert className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-2xl font-semibold uppercase tracking-wide text-white">
          Algo saiu do lugar
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Não foi possível carregar esta página agora. Seus dados continuam salvos. Tente novamente; se persistir,
          avise um administrador.
        </p>
        {error.digest ? (
          <p className="mt-2 text-[10px] uppercase tracking-wider text-muted/60">Código: {error.digest}</p>
        ) : null}
        <div className="mt-5 flex flex-col gap-2">
          <Button onClick={reset} size="lg">
            <RefreshCw className="h-4 w-4" aria-hidden />
            Tentar novamente
          </Button>
          <Link href="/inicio" className={cn(buttonVariants({ variant: "ghost", block: true }))}>
            Voltar para o início
          </Link>
        </div>
      </div>
    </div>
  );
}
