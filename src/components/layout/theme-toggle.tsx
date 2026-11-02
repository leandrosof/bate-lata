"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "dark" | "light";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("arena-theme", theme);
  } catch {
    // ignora navegadores com armazenamento bloqueado
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#f3f6fb" : "#070b14");
}

export function ThemeToggle({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        const current = document.documentElement.dataset.theme === "light" ? "light" : "dark";
        applyTheme(current === "light" ? "dark" : "light");
      }}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface-2/60 text-muted transition hover:border-line-strong hover:text-ink",
        className,
      )}
      aria-label="Alternar tema"
      title="Alternar tema"
    >
      <Sun className="theme-icon-dark h-4 w-4" aria-hidden />
      <Moon className="theme-icon-light h-4 w-4" aria-hidden />
    </button>
  );
}
