import { ButtonHTMLAttributes, forwardRef } from "react";
import { classNames } from "@/lib/format";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClass: Record<Variant, string> = {
  primary:
    "bg-brand-600 hover:bg-brand-700 text-white shadow-sm disabled:bg-brand-300 disabled:cursor-not-allowed",
  secondary:
    "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700",
  ghost: "text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800",
  danger: "bg-red-600 hover:bg-red-700 text-white"
};

const sizeClass: Record<Size, string> = {
  sm: "h-8 text-xs px-3 rounded-md",
  md: "h-10 text-sm px-4 rounded-md",
  lg: "h-11 text-base px-5 rounded-lg"
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={classNames(
        "inline-flex items-center justify-center gap-2 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/40",
        variantClass[variant],
        sizeClass[size],
        className
      )}
      {...rest}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
});
