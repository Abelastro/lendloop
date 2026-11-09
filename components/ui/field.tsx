import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-field border border-line bg-paper px-3.5 text-sm text-ink placeholder:text-faint transition focus:border-moss focus:ring-2 focus:ring-moss/50 focus:ring-offset-2 focus:ring-offset-paper focus:outline-none disabled:opacity-60";

export function Label({
  htmlFor,
  children,
  hint,
}: {
  htmlFor: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <label htmlFor={htmlFor} className="text-ink text-[13px] font-medium">
        {children}
      </label>
      {hint ? <span className="text-faint text-[11px]">{hint}</span> : null}
    </div>
  );
}

export function FieldHint({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="text-faint text-[11px] leading-4">
      {children}
    </p>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "min-h-24 py-3", className)} {...props} />;
}

export function FieldError({ id, children }: { id: string; children?: string | null }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" aria-live="polite" className="text-clay text-xs leading-5">
      {children}
    </p>
  );
}
