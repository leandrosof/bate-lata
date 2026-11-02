"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

function buildMessage(input: {
  title: string;
  dateLabel: string;
  venue: string;
  surface?: string | null;
  token?: string | null;
  confirmed: string[];
  organizers: string[];
}) {
  const lines = [
    input.title,
    `${input.dateLabel} · ${input.venue}${input.surface ? ` · ${input.surface}` : ""}`,
    "",
  ];

  if (input.confirmed.length > 0) {
    lines.push("Confirmados:");
    lines.push(...input.confirmed.map((name) => `- ${name}`));
  } else {
    lines.push("Ninguém confirmou ainda.");
  }

  if (input.organizers.length > 0) {
    lines.push("", "Organização:");
    lines.push(...input.organizers.map((name) => `- ${name}`));
  }

  if (input.token) {
    lines.push("", `Lista completa: ${window.location.origin}/e/${input.token}`);
  }

  return lines.join("\n");
}

export function ShareAttendanceButton({
  title,
  dateLabel,
  venue,
  surface,
  token,
  confirmed,
  organizers,
}: {
  title: string;
  dateLabel: string;
  venue: string;
  surface?: string | null;
  token?: string | null;
  confirmed: string[];
  organizers: string[];
}) {
  const [copied, setCopied] = useState(false);

  const message = () =>
    buildMessage({ title, dateLabel, venue, surface, token, confirmed, organizers });

  async function copy() {
    try {
      await navigator.clipboard.writeText(message());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copie a lista:", message());
    }
  }

  function whatsapp() {
    const text = encodeURIComponent(message());
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="secondary" size="sm" onClick={() => void copy()}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Lista copiada" : "Copiar lista"}
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={whatsapp}>
        <MessageCircle className="h-4 w-4" />
        WhatsApp
      </Button>
    </div>
  );
}
