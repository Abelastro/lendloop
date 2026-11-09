"use client";

import Link from "next/link";
import { WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

export default function RootError({ reset }: { reset: () => void }) {
  return (
    <div className="shell flex min-h-[70dvh] items-center justify-center py-16">
      <div className="border-line bg-surface rounded-card w-full max-w-md border p-7 text-center">
        <div className="bg-clay/10 text-clay mx-auto grid size-10 place-items-center rounded-full">
          <WarningCircle size={21} aria-hidden />
        </div>
        <h1 className="mt-5 text-xl font-semibold tracking-[-0.02em]">
          Something went sideways.
        </h1>
        <p className="text-muted mt-2 text-sm leading-6">
          The page hit an unexpected error. Your data is safe. Try again, or head back
          to the board.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <Link
            href="/"
            className="text-muted hover:bg-sunken hover:text-ink inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition"
          >
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}
