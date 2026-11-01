"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { VariantProps } from "class-variance-authority";
import type { ActionState } from "@/lib/action";
import { cn } from "@/lib/utils";
import { Alert } from "./alert";
import { ConfirmDialog } from "./confirm-dialog";
import { SubmitButton } from "./submit-button";
import { buttonVariants } from "./button";

export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel,
  className,
  resetOnSuccess,
  confirmMessage,
  confirmTitle,
  confirmLabel,
  variant,
  size,
  block,
  footerStart,
  submitIcon,
  hiddenFields,
  submitClassName,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children?: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  resetOnSuccess?: boolean;
  confirmMessage?: string;
  confirmTitle?: string;
  confirmLabel?: string;
  footerStart?: React.ReactNode;
  submitIcon?: React.ReactNode;
  hiddenFields?: Record<string, string | number | boolean | undefined | null>;
  submitClassName?: string;
} & VariantProps<typeof buttonVariants>) {
  const [state, formAction] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const bypassConfirm = useRef(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  const fieldErrorMessages = state?.fieldErrors
    ? Object.entries(state.fieldErrors).flatMap(([field, messages]) =>
        field === "_form" ? [] : messages.map((message) => (field === "email" ? message : `${field}: ${message}`)),
      )
    : [];

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        className={cn("space-y-3.5", className)}
        onSubmit={(event) => {
          if (confirmMessage && !bypassConfirm.current) {
            event.preventDefault();
            setConfirmOpen(true);
          }
        }}
      >
        {hiddenFields
          ? Object.entries(hiddenFields).map(([name, value]) =>
              value === undefined || value === null ? null : (
                <input key={name} type="hidden" name={name} value={String(value)} />
              ),
            )
          : null}

        {children}

        {state && !state.ok ? (
          <Alert tone="danger">
            <p>{state.message ?? "Não foi possível salvar."}</p>
            {fieldErrorMessages.length > 0 ? (
              <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs opacity-90">
                {fieldErrorMessages.map((message, index) => (
                  <li key={`${message}-${index}`}>{message}</li>
                ))}
              </ul>
            ) : null}
          </Alert>
        ) : null}

        {state?.ok && state.message ? <Alert tone="success">{state.message}</Alert> : null}

        <div className="flex flex-wrap items-center gap-2">
          {footerStart}
          <SubmitButton
            label={submitLabel}
            pendingLabel={pendingLabel}
            variant={variant}
            size={size}
            block={block}
            icon={submitIcon}
            className={submitClassName}
          />
        </div>
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
