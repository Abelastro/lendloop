"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-ink/35 fixed inset-0 z-50 backdrop-blur-[2px] data-[state=closed]:animate-none" />
        <Dialog.Content
          className={cn(
            "border-line bg-surface rounded-card fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto border p-6 shadow-[0_24px_80px_-24px_rgba(23,32,25,0.45)] sm:p-7",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <Dialog.Title className="text-ink text-xl font-semibold tracking-[-0.02em]">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="text-muted text-sm leading-6">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close
              className="text-muted hover:bg-sunken hover:text-ink -mt-1 -mr-1 grid size-8 place-items-center rounded-full transition"
              aria-label="Close dialog"
            >
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="mt-6">{children}</div>
          {footer ? <div className="mt-7">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
