import { PropsWithChildren } from "react";
import { classNames } from "@/lib/format";

export function Card({ className, children }: PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={classNames(
        "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={classNames("px-5 pt-5 pb-3", className)}>{children}</div>;
}

export function CardBody({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={classNames("px-5 pb-5", className)}>{children}</div>;
}

export function CardTitle({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <h3 className={classNames("font-semibold text-slate-900 dark:text-slate-100", className)}>{children}</h3>;
}
