import Image from "next/image";
import Link from "next/link";
import { Show } from "@clerk/nextjs";
import {
  ArrowRight,
  BellRinging,
  CheckCircle,
  Key,
  SealCheck,
  ShieldCheck,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import { PublicBoard } from "@/components/landing/public-board";
import { SiteHeader } from "@/components/landing/site-header";

const steps = [
  {
    title: "List the idle thing",
    body: "Add a name, category, condition, and one honest line. It takes less than a minute.",
  },
  {
    title: "Ask for a window",
    body: "Pick dates that work. LendLoop checks overlaps before the request reaches the owner.",
  },
  {
    title: "Lend, remind, return",
    body: "The owner approves. Signed automations send updates and a friendly nudge if a loan runs late.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />

      <main>
        <section className="relative overflow-hidden">
          <div className="shell grid items-center gap-12 pt-12 pb-16 md:pt-20 md:pb-24 lg:grid-cols-[1.03fr_0.97fr] lg:gap-16">
            <div className="rise max-w-xl">
              <p className="text-moss font-mono text-[10.5px] tracking-[0.22em] uppercase">
                A neighborhood tool board
              </p>
              <h1 className="mt-5 text-[44px] leading-[0.98] font-semibold tracking-[-0.055em] text-balance sm:text-6xl lg:text-[68px]">
                Borrow what you need.
                <span className="text-muted block">Lend what you don&apos;t.</span>
              </h1>
              <p className="text-muted mt-6 max-w-[42ch] text-[15px] leading-7 md:text-base">
                The drill, ladder, or camping stove that only gets used a few times a
                year.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Show when="signed-out">
                  <Link
                    href="/sign-in"
                    className="bg-moss text-on-moss hover:bg-moss-strong inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-medium transition active:translate-y-px"
                  >
                    Sign in to lend or borrow
                    <ArrowRight size={16} weight="bold" />
                  </Link>
                </Show>
                <Show when="signed-in">
                  <Link
                    href="/app"
                    className="bg-moss text-on-moss hover:bg-moss-strong inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-medium transition active:translate-y-px"
                  >
                    Open your workspace
                    <ArrowRight size={16} weight="bold" />
                  </Link>
                </Show>
                <a
                  href="#board"
                  className="border-line bg-surface text-ink hover:border-faint hover:bg-sunken inline-flex h-12 items-center justify-center rounded-full border px-6 text-sm font-medium transition"
                >
                  Browse the board
                </a>
              </div>
            </div>

            <div className="rise rise-delay-2 relative">
              <div className="border-line bg-sunken rounded-card relative aspect-[4/5] overflow-hidden border sm:aspect-[5/4] lg:aspect-auto lg:h-[min(64vh,640px)]">
                <Image
                  src="https://images.pexels.com/photos/10894122/pexels-photo-10894122.jpeg"
                  alt="A warmly lit neighborhood workshop with tools on the wall"
                  fill
                  priority
                  sizes="(min-width: 1024px) 46vw, 100vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f1711]/65 via-transparent to-transparent" />
                <div className="rounded-field absolute inset-x-4 bottom-4 flex items-end justify-between gap-3 border border-white/15 bg-[#101711]/55 px-4 py-3 text-white backdrop-blur-md sm:inset-x-5 sm:bottom-5">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-8 place-items-center rounded-full bg-white/12">
                      <UsersThree size={17} />
                    </span>
                    <div>
                      <p className="text-[13px] font-medium">
                        Neighbors helping neighbors
                      </p>
                      <p className="text-[11px] text-white/65">
                        No feeds. No noise. Just tools.
                      </p>
                    </div>
                  </div>
                  <span className="hidden rounded-full bg-white/12 px-2.5 py-1 text-[10px] tracking-[0.16em] text-white/75 uppercase sm:block">
                    Live
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <PublicBoard />

        <section id="how" className="scroll-mt-20 py-20 md:py-28">
          <div className="shell grid gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-20">
            <div className="border-line bg-sunken rounded-card relative aspect-[4/5] overflow-hidden border">
              <Image
                src="https://images.pexels.com/photos/10414793/pexels-photo-10414793.jpeg"
                alt="A black and white workbench with hand tools laid out"
                fill
                sizes="(min-width: 1024px) 42vw, 100vw"
                className="object-cover"
              />
              <div className="absolute top-5 left-5 rounded-full bg-[#101711]/70 px-3 py-1.5 text-[10px] tracking-[0.18em] text-white/80 uppercase backdrop-blur">
                The idle shelf
              </div>
            </div>

            <div>
              <h2 className="text-3xl font-semibold tracking-[-0.04em] text-balance md:text-5xl">
                A small loop that keeps things moving.
              </h2>
              <p className="text-muted mt-4 max-w-[46ch] text-[15px] leading-7">
                No marketplace theatre. One clear path from a dusty shelf to a
                neighbor&apos;s project, with the handoffs written down.
              </p>

              <ol className="mt-10 space-y-0">
                {steps.map((step, index) => (
                  <li
                    key={step.title}
                    className="grid grid-cols-[auto_1fr] gap-5 pb-9 last:pb-0"
                  >
                    <div className="flex flex-col items-center">
                      <span className="border-moss/25 bg-moss/10 text-moss grid size-9 place-items-center rounded-full border font-mono text-xs">
                        0{index + 1}
                      </span>
                      {index < steps.length - 1 ? (
                        <span className="bg-line mt-3 h-full w-px" aria-hidden />
                      ) : null}
                    </div>
                    <div className="pt-1">
                      <h3 className="text-ink text-[15px] font-semibold">
                        {step.title}
                      </h3>
                      <p className="text-muted mt-1.5 max-w-[42ch] text-sm leading-6">
                        {step.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section
          id="trust"
          className="border-line bg-sunken scroll-mt-20 border-y py-20 md:py-28"
        >
          <div className="shell">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-[-0.04em] text-balance md:text-5xl">
                Trust is a product decision.
              </h2>
              <p className="text-muted mt-4 max-w-[52ch] text-[15px] leading-7">
                LendLoop exposes the minimum needed to make a borrow work. The rest
                stays with the people involved.
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              <div className="border-line bg-paper rounded-card border p-6 md:col-span-2 md:p-8">
                <Key size={23} className="text-moss" />
                <h3 className="mt-5 text-lg font-semibold tracking-[-0.02em]">
                  Private by default
                </h3>
                <p className="text-muted mt-3 max-w-[54ch] text-sm leading-6">
                  The public board shows a tool&apos;s name and category, nothing else.
                  Signed-in neighbors can see who listed a tool; emails and street
                  addresses never appear on the board.
                </p>
                <div className="border-line mt-7 grid gap-3 border-t pt-6 sm:grid-cols-2">
                  <div className="text-muted flex gap-2.5 text-[13px] leading-5">
                    <CheckCircle size={17} className="text-moss mt-0.5 shrink-0" />
                    Emails never appear on a listing.
                  </div>
                  <div className="text-muted flex gap-2.5 text-[13px] leading-5">
                    <CheckCircle size={17} className="text-moss mt-0.5 shrink-0" />
                    No street addresses are collected.
                  </div>
                </div>
              </div>

              <div className="border-line bg-paper rounded-card border p-6">
                <SealCheck size={23} className="text-moss" />
                <h3 className="mt-5 text-lg font-semibold tracking-[-0.02em]">
                  Signed, both ways
                </h3>
                <p className="text-muted mt-3 text-sm leading-6">
                  Convex and n8n prove every automation call with a time-bound HMAC
                  signature. Secrets live in environment variables, not workflow JSON.
                </p>
              </div>

              <div className="border-line bg-paper rounded-card border p-6">
                <ShieldCheck size={23} className="text-moss" />
                <h3 className="mt-5 text-lg font-semibold tracking-[-0.02em]">
                  Roles enforced in the data layer
                </h3>
                <p className="text-muted mt-3 text-sm leading-6">
                  Borrowers, lenders, and admins are checked inside Convex mutations,
                  not just hidden in the interface.
                </p>
              </div>

              <div className="border-line bg-paper rounded-card border p-6 md:col-span-2">
                <BellRinging size={23} className="text-moss" />
                <h3 className="mt-5 text-lg font-semibold tracking-[-0.02em]">
                  Failures leave a trail
                </h3>
                <p className="text-muted mt-3 max-w-[58ch] text-sm leading-6">
                  Every notification attempt is recorded. Retries back off. If n8n still
                  fails, its error workflow files an incident admins can see and
                  resolve.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 md:py-28">
          <div className="shell">
            <div className="border-line rounded-card relative overflow-hidden border bg-[#111a14] px-6 py-16 text-white md:px-12 md:py-24">
              <Image
                src="https://images.pexels.com/photos/7728140/pexels-photo-7728140.jpeg"
                alt="Neighbors working together in a community garden"
                fill
                sizes="(min-width: 1240px) 1176px, 100vw"
                className="object-cover opacity-40"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0e1710]/90 via-[#0e1710]/65 to-transparent" />
              <div className="relative max-w-xl">
                <h2 className="text-3xl font-semibold tracking-[-0.04em] text-balance md:text-5xl">
                  There&apos;s a drill three doors down.
                </h2>
                <p className="mt-4 max-w-[42ch] text-[15px] leading-7 text-white/70">
                  List one thing this week. Borrow one thing you need. Keep the loop
                  local.
                </p>
                <Show when="signed-out">
                  <Link
                    href="/sign-up"
                    className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-[#f4f6f0] px-6 text-sm font-medium text-[#172019] transition hover:bg-white active:translate-y-px"
                  >
                    Join LendLoop
                    <ArrowRight size={16} weight="bold" />
                  </Link>
                </Show>
                <Show when="signed-in">
                  <Link
                    href="/app"
                    className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-[#f4f6f0] px-6 text-sm font-medium text-[#172019] transition hover:bg-white active:translate-y-px"
                  >
                    Open your workspace
                    <ArrowRight size={16} weight="bold" />
                  </Link>
                </Show>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-line border-t py-10">
        <div className="shell text-faint flex flex-col gap-5 text-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="text-muted flex items-center gap-2 font-medium">
            <span className="bg-moss text-on-moss grid size-6 place-items-center rounded-full">
              <ArrowRight size={12} weight="bold" />
            </span>
            LendLoop
          </div>
          <p>A fictional neighborhood project built for demonstration.</p>
          <div className="flex gap-5">
            <a href="#board" className="hover:text-ink transition">
              Board
            </a>
            <a href="#trust" className="hover:text-ink transition">
              Privacy
            </a>
            <a href="#how" className="hover:text-ink transition">
              How it works
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
