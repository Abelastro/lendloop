import Link from "next/link";
import { ArrowsClockwise } from "@phosphor-icons/react/dist/ssr";

export default function NotFound() {
  return (
    <div className="shell flex min-h-[70dvh] items-center justify-center py-16">
      <div className="border-line bg-surface rounded-card w-full max-w-md border p-7 text-center">
        <div className="bg-moss/10 text-moss mx-auto grid size-10 place-items-center rounded-full">
          <ArrowsClockwise size={21} aria-hidden />
        </div>
        <p className="text-moss mt-5 font-mono text-[10.5px] tracking-[0.22em] uppercase">
          404
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-[-0.02em]">
          This shelf is empty.
        </h1>
        <p className="text-muted mt-2 text-sm leading-6">
          The page you were looking for does not exist, or the tool has been taken off
          the board.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link
            href="/"
            className="bg-moss text-on-moss hover:bg-moss-strong inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition"
          >
            Back home
          </Link>
          <Link
            href="/app"
            className="text-muted hover:bg-sunken hover:text-ink inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition"
          >
            Open the board
          </Link>
        </div>
      </div>
    </div>
  );
}
