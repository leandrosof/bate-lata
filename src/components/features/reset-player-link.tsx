"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, KeyRound, Loader2 } from "lucide-react";
import { managePlayerAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils";

function LinkPanel({ link }: { link: string }) {
  const [visible, setVisible] = useState(true);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 30_000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      inputRef.current?.select();
      document.execCommand("copy");
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  }

  return (
    <div
      aria-live="polite"
      className="mt-2 rounded-xl border border-brand/30 bg-brand-soft/40 p-2.5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Input
          ref={inputRef}
          readOnly
          value={link}
          aria-label="Link de redefinição de senha"
          className="h-9 min-w-0 flex-1 basis-56 font-mono text-xs"
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button type="button" size="sm" onClick={() => void copy()}>
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          {copied ? "Copiado!" : "Copiar"}
        </Button>
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 text-[13px] font-semibold text-ink transition hover:border-line-strong hover:bg-surface-3",
          )}
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          Abrir
        </a>
      </div>
      <p className="mt-1.5 text-[10px] text-muted">
        Este painel some em 30 segundos. O link também foi enviado para o e-mail do jogador.
      </p>
    </div>
  );
}

export function ResetPlayerLink({ userId, playerName }: { userId: string; playerName: string }) {
  const [state, formAction, pending] = useActionState(managePlayerAction, null);
  const { toast } = useToast();
  const link = state?.values?.resetLink;

  useEffect(() => {
    if (!state?.message) return;
    toast({ message: state.message, tone: state.ok ? "success" : "error" });
  }, [state, toast]);

  return (
    <div className="min-w-0">
      <form action={formAction}>
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="action" value="reset-link" />
        <Button type="submit" variant="ghost" size="sm" disabled={pending}>
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <KeyRound className="h-3.5 w-3.5" aria-hidden />
          )}
          {pending ? "Gerando..." : "Gerar link de senha"}
        </Button>
      </form>
      {link ? <LinkPanel key={link} link={link} /> : null}
      <span className="sr-only">Gerar link de redefinição para {playerName}</span>
    </div>
  );
}
