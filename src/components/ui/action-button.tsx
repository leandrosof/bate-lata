"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { VariantProps } from "class-variance-authority";
import type { ActionState } from "@/lib/action";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "./button";
import { ConfirmDialog } from "./confirm-dialog";
import { useToast } from "./toast-provider";

export function ActionButton({
  action,
  fields,
  children,
  className,
  variant,
  size,
  block,
  confirmMessage,
  confirmTitle,
  confirmLabel,
  icon,
  pendingLabel,
  formClassName,
  disabled,
  title,
  showFeedback,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  fields?: Record<string, string | number | boolean | undefined>;
  className?: string;
  confirmMessage?: string;
  confirmTitle?: string;
  confirmLabel?: string;
  icon?: React.ReactNode;
  pendingLabel?: string;
  formClassName?: string;
  disabled?: boolean;
  title?: string;
  showFeedback?: boolean;
  children?: React.ReactNode;
} & VariantProps<typeof buttonVariants>) {
  const [state, formAction, pending] = useActionState(action, null);
  const { toast } = useToast();
  const renderFeedback = showFeedback ?? !size?.startsWith("icon");
  const formRef = useRef<HTMLFormElement>(null);
  const bypassConfirm = useRef(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!renderFeedback || !state?.message) return;
    toast({ message: state.message, tone: state.ok ? "success" : "error" });
  }, [renderFeedback, state, toast]);

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        className={cn("min-w-0", formClassName)}
        onSubmit={(event) => {
          if (confirmMessage && !bypassConfirm.current) {
            event.preventDefault();
            setConfirmOpen(true);
          }
        }}
      >
        {fields
          ? Object.entries(fields).map(([name, value]) =>
              value === undefined ? null : <input key={name} type="hidden" name={name} value={String(value)} />,
            )
          : null}
        <Button
          type="submit"
          variant={variant}
          size={size}
          block={block}
          className={className}
          disabled={pending || disabled}
          title={title}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
          {pending ? (pendingLabel ?? "Aguarde...") : children}
        </Button>
      </form>

      {confirmMessage ? (
        <ConfirmDialog
          open={confirmOpen}
          title={confirmTitle ?? "Confirmar ação"}
          message={confirmMessage}
          confirmLabel={confirmLabel ?? "Confirmar"}
          tone={variant === "danger" ? "danger" : "warning"}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => {
            setConfirmOpen(false);
            bypassConfirm.current = true;
            formRef.current?.requestSubmit();
            bypassConfirm.current = false;
          }}
        />
      ) : null}
    </>
  );
}
