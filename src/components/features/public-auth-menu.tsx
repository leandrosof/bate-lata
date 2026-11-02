"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { LogIn, UserPlus, UserRound, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PublicAuthMenu({
  loginHref = "/entrar",
  registerHref = "/cadastro",
}: {
  loginHref?: string;
  registerHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    const timer = window.setTimeout(() => closeRef.current?.focus(), 20);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(timer);
    };
  }, [open]);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir opções de acesso"
        title="Entrar ou criar conta"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface-2/70 text-ink transition hover:border-brand/40 hover:text-brand"
      >
        <UserRound className="h-5 w-5" aria-hidden />
      </button>

      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center sm:p-4"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setOpen(false);
              }}
            >
              <div
                className="absolute inset-0 bg-black/65 backdrop-blur-sm"
                aria-hidden
                onClick={() => setOpen(false)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_24px_60px_-24px_rgba(0,0,0,0.45)]"
              >
                <div className="flex items-start justify-between gap-3 p-5 pb-3">
                  <div>
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                      <UserRound className="h-5 w-5" aria-hidden />
                    </span>
                    <h2
                      id={titleId}
                      className="mt-3 font-display text-2xl font-semibold uppercase tracking-wide text-ink"
                    >
                      Acessar o grupo
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-muted">
                      Entre na sua conta ou crie uma para confirmar presença e acompanhar o racha.
                    </p>
                  </div>
                  <button
                    ref={closeRef}
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Fechar"
                    className="rounded-lg p-1 text-muted transition hover:bg-ink/5 hover:text-ink"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>

                <div className="space-y-2 border-t border-line/70 bg-surface-2/30 p-3">
                  <Link
                    href={loginHref}
                    onClick={() => setOpen(false)}
                    className={cn(buttonVariants({ size: "lg" }), "w-full justify-center")}
                  >
                    <LogIn className="h-4 w-4" aria-hidden />
                    Entrar
                  </Link>
                  <Link
                    href={registerHref}
                    onClick={() => setOpen(false)}
                    className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "w-full justify-center")}
                  >
                    <UserPlus className="h-4 w-4" aria-hidden />
                    Criar conta
                  </Link>
                  <Link
                    href="/termos"
                    onClick={() => setOpen(false)}
                    className="block pt-1 text-center text-xs font-medium text-muted underline-offset-2 hover:text-ink hover:underline"
                  >
                    Termos de uso
                  </Link>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
