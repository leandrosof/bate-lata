"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { CircleCheck, CircleX, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error";

type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ToastInput = {
  message: string;
  tone?: ToastTone;
  duration?: number;
};

const ToastContext = createContext<{ toast: (input: ToastInput) => void } | null>(null);

const subscribe = () => () => {};

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast precisa estar dentro de ToastProvider.");
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    ({ message, tone = "success", duration = 5000 }: ToastInput) => {
      const id = (idRef.current += 1);
      setToasts((current) => [...current, { id, message, tone }]);
      window.setTimeout(() => remove(id), duration);
    },
    [remove],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted
        ? createPortal(
            <div className="pointer-events-none fixed bottom-20 right-4 z-[200] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2 sm:bottom-6">
              {toasts.map((item) => (
                <div
                  key={item.id}
                  role={item.tone === "error" ? "alert" : "status"}
                  className={cn(
                    "pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm shadow-xl backdrop-blur-md animate-[rise_0.2s_ease-out_both]",
                    item.tone === "success"
                      ? "border-success/30 bg-success-soft text-success"
                      : "border-danger/30 bg-danger-soft text-danger",
                  )}
                >
                  {item.tone === "success" ? (
                    <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  ) : (
                    <CircleX className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1 break-words font-medium">{item.message}</span>
                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    className="shrink-0 rounded p-0.5 opacity-70 transition hover:opacity-100"
                    aria-label="Fechar aviso"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}
