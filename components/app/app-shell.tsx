"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  ArrowsClockwise,
  PaperPlaneTilt,
  ShieldCheck,
  SquaresFour,
  Toolbox,
  Tray,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useViewer } from "./workspace";

const baseLinks = [
  { href: "/app", label: "The board", icon: SquaresFour },
  { href: "/app/listings", label: "My listings", icon: Toolbox },
  { href: "/app/requests", label: "My requests", icon: PaperPlaneTilt },
  { href: "/app/incoming", label: "Incoming", icon: Tray },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/app" ? pathname === "/app" : pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const viewer = useViewer();
  const links =
    viewer.role === "admin"
      ? [...baseLinks, { href: "/app/admin", label: "Admin", icon: ShieldCheck }]
      : baseLinks;

  return (
    <div className="min-h-[100dvh]">
      <header className="border-line/80 bg-paper/90 sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="shell flex h-16 items-center justify-between gap-6">
          <div className="flex items-center gap-7">
            <Link href="/app" className="flex items-center gap-2.5">
              <span className="bg-moss text-on-moss grid size-8 place-items-center rounded-full">
                <ArrowsClockwise size={17} weight="bold" />
              </span>
              <span className="text-[17px] font-semibold tracking-[-0.03em]">
                LendLoop
              </span>
            </Link>
            <nav className="hidden items-center gap-1 lg:flex" aria-label="Workspace">
              {links.map((link) => {
                const Icon = link.icon;
                const active = isActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition",
                      active
                        ? "bg-sunken text-ink"
                        : "text-muted hover:bg-sunken/70 hover:text-ink",
                    )}
                  >
                    <Icon size={16} weight={active ? "fill" : "regular"} />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="max-w-40 truncate text-[13px] leading-5 font-medium">
                {viewer.name}
              </p>
              <p className="text-faint text-[10px] tracking-[0.12em] uppercase">
                {viewer.role === "admin"
                  ? "Admin"
                  : viewer.trustedLender
                    ? "Trusted lender"
                    : "Neighbor"}
              </p>
            </div>
            <UserButton />
          </div>
        </div>

        <nav
          className="border-line flex gap-1 overflow-x-auto border-t px-4 py-2 lg:hidden"
          aria-label="Workspace mobile"
        >
          {links.map((link) => {
            const Icon = link.icon;
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
                  active
                    ? "bg-moss text-on-moss"
                    : "text-muted hover:bg-sunken hover:text-ink",
                )}
              >
                <Icon size={14} weight={active ? "fill" : "regular"} />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="shell pt-8 pb-20 md:pt-10">{children}</main>
    </div>
  );
}
