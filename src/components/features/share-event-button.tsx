"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShareEventButton({
  token,
  title,
  onDark,
}: {
  token: string;
  title: string;
  onDark?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  function url() {
    return `${window.location.origin}/e/${token}`;
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copie o link:", url());
    }
  }

  function whatsapp() {
    const text = encodeURIComponent(`${title} — confirme sua presença: ${url()}`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant={onDark ? "white" : "secondary"}
        size="sm"
        onClick={() => void copy()}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Link copiado" : "Copiar link"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={whatsapp}
        className={
          onDark
            ? "border-white/25 bg-white/10 text-white hover:border-white/40 hover:bg-white/15 hover:text-white"
            : undefined
        }
      >
        <MessageCircle className="h-4 w-4" />
        WhatsApp
      </Button>
    </div>
  );
}
