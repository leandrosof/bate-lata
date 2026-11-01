import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-55 active:translate-y-px",
  {
    variants: {
      variant: {
        primary:
          "bg-brand text-white shadow-[0_10px_30px_-14px_rgba(47,107,255,0.95)] hover:bg-brand-strong",
        secondary:
          "border border-line bg-surface-2 text-ink hover:border-line-strong hover:bg-surface-3",
        outline:
          "border border-brand/45 bg-brand-soft/40 text-[#9db8ff] hover:bg-brand-soft hover:text-white",
        ghost: "text-muted hover:bg-white/5 hover:text-ink",
        danger:
          "border border-[rgba(240,82,82,0.35)] bg-[rgba(240,82,82,0.14)] text-[#ff9a9a] hover:bg-[rgba(240,82,82,0.22)]",
        success:
          "border border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.14)] text-[#86efac] hover:bg-[rgba(34,197,94,0.22)]",
        white: "bg-white text-[#0b1220] hover:bg-slate-100",
      },
      size: {
        sm: "h-9 px-3 text-[13px]",
        md: "h-11 px-4 text-sm",
        lg: "h-12 px-6 text-[15px]",
        xl: "h-14 px-7 text-base",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
      },
      block: {
        true: "w-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, block, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  );
}
