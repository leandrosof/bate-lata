"use client";

import { CircleCheck, CircleX } from "lucide-react";
import type { ActionState } from "@/lib/action";
import { cn } from "@/lib/utils";

export function ActionFeedback({
  state,
  className,
}: {
  state: ActionState;
  className?: string;
}) {
  if (!state?.message) return null;

  const ok = state.ok;
  const Icon = ok ? CircleCheck : CircleX;

  return (
    <div
      key={`${ok}-${state.message}`}
      role={ok ? "status" : "alert"}
      className={cn(
        "feedback-auto-hide pointer-events-none fixed bottom-24 right-4 z-[120] flex max-w-[min(22rem,calc(100vw-2rem))] items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm shadow-lg backdrop-blur-md sm:bottom-6",
        ok
          ? "border-success/30 bg-success-soft text-success"
          : "border-danger/30 bg-danger-soft text-danger",
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span className="break-words font-medium">{state.message}</span>
    </div>
  );
}
