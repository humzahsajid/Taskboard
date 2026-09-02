import clsx from "clsx";
import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
  useEffect,
} from "react";
import { X } from "lucide-react";
import { initials } from "../lib/format";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-slate-900",
        size === "sm" ? "px-2.5 py-1 text-sm" : "px-3.5 py-2 text-sm",
        variant === "primary" && "bg-brand-600 text-white hover:bg-brand-700",
        variant === "secondary" &&
          "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600 dark:hover:bg-slate-700",
        variant === "ghost" &&
          "text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-700/70",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
        className,
      )}
      {...props}
    />
  );
}

const fieldClasses =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(fieldClasses, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(fieldClasses, className)} {...props} />;
}

export function Avatar({
  name,
  color,
  size = 28,
  title,
}: {
  name: string;
  color: string;
  size?: number;
  title?: string;
}) {
  return (
    <span
      title={title ?? name}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-white dark:ring-slate-800"
      style={{ background: color, width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials(name)}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-3 dark:bg-black/60 sm:p-6"
      onMouseDown={onClose}
    >
      <div
        className={clsx(
          "my-4 w-full rounded-xl bg-slate-50 shadow-xl dark:bg-slate-900 dark:ring-1 dark:ring-slate-700",
          wide ? "max-w-3xl" : "max-w-md",
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({ title, onClose }: { title: ReactNode; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      <button
        onClick={onClose}
        className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
        aria-label="Close"
      >
        <X size={20} />
      </button>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 p-10 text-slate-500 dark:text-slate-400">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600 dark:border-slate-600 dark:border-t-brand-500" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
