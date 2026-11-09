import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "moss" | "warning" | "clay" | "quiet";

const tones: Record<Tone, string> = {
  neutral: "border-line bg-surface text-muted",
  moss: "border-moss/20 bg-moss/10 text-moss",
  warning: "border-warning/25 bg-warning/10 text-warning",
  clay: "border-clay/25 bg-clay/10 text-clay",
  quiet: "border-transparent bg-sunken text-muted",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
