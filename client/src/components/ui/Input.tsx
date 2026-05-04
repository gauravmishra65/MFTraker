import { InputHTMLAttributes, forwardRef } from "react";
import { classNames } from "@/lib/format";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, hint, className, id, ...rest },
  ref
) {
  const inputId = id ?? rest.name;
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={classNames(
          "w-full h-10 px-3 rounded-md text-sm",
          "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700",
          "placeholder:text-slate-400 text-slate-900 dark:text-slate-100",
          "focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500",
          error && "border-red-500 focus:ring-red-200 focus:border-red-500",
          className
        )}
        {...rest}
      />
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
});
