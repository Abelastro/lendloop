"use client";

import { useState } from "react";
import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
import { ArrowsClockwise, ArrowUpRight, List, X } from "@phosphor-icons/react";

const links = [
  { href: "#board", label: "The board" },
  { href: "#how", label: "How it works" },
  { href: "#trust", label: "Trust & privacy" },
];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="border-line/80 bg-paper/85 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="shell flex h-16 items-center justify-between gap-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-semibold tracking-[-0.03em]"
        >
          <span className="bg-moss text-on-moss grid size-8 place-items-center rounded-full">
            <ArrowsClockwise size={17} weight="bold" aria-hidden />
          </span>
          <span className="text-[17px]">LendLoop</span>
        </Link>

        <nav className="text-muted hidden items-center gap-7 text-sm md:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="hover:text-ink transition">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Show when="signed-out">
            <Link
              href="/sign-in"
              className="text-muted hover:text-ink hidden rounded-full px-3.5 py-2 text-sm font-medium transition sm:block"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="bg-moss text-on-moss hover:bg-moss-strong inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium transition"
            >
              Join LendLoop
              <ArrowUpRight size={14} weight="bold" aria-hidden />
            </Link>
          </Show>
          <Show when="signed-in">
            <Link
              href="/app"
              className="bg-moss text-on-moss hover:bg-moss-strong inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium transition"
            >
              Open the board
              <ArrowUpRight size={14} weight="bold" aria-hidden />
            </Link>
            <UserButton />
          </Show>
          <button
            type="button"
            className="border-line text-ink grid size-9 place-items-center rounded-full border transition md:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((value) => !value)}
          >
            {menuOpen ? (
              <X size={17} weight="bold" aria-hidden />
            ) : (
              <List size={17} weight="bold" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <nav
          id="mobile-nav"
          className="border-line bg-surface absolute inset-x-0 top-full border-b shadow-sm md:hidden"
        >
          <div className="shell flex flex-col gap-1 py-3">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-muted hover:bg-sunken hover:text-ink rounded-field px-3 py-2.5 text-sm transition"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <Show when="signed-out">
              <Link
                href="/sign-in"
                className="text-muted hover:bg-sunken hover:text-ink rounded-field px-3 py-2.5 text-sm transition"
                onClick={() => setMenuOpen(false)}
              >
                Sign in
              </Link>
            </Show>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
