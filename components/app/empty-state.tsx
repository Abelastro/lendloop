import type { Icon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: Icon;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="border-line bg-surface rounded-card border border-dashed px-6 py-16 text-center">
      <div className="bg-sunken text-muted mx-auto grid size-11 place-items-center rounded-full">
        <Icon size={22} />
      </div>
      <h2 className="mt-5 text-base font-semibold tracking-[-0.01em]">{title}</h2>
      <p className="text-muted mx-auto mt-2 max-w-sm text-sm leading-6">{body}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}
