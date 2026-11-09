"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { ArrowRight, MagnifyingGlass } from "@phosphor-icons/react";
import { api } from "@/convex/_generated/api";
import { CATEGORIES } from "@/convex/lib/constants";
import { cn } from "@/lib/utils";

const ALL = "All tools";

function SkeletonRow({ index }: { index: number }) {
  return (
    <div
      className="border-line/80 flex items-center justify-between gap-4 border-b py-4"
      style={{ opacity: 1 - index * 0.08 }}
    >
      <div className="space-y-2">
        <div className="bg-sunken h-4 w-36 rounded-full" />
        <div className="bg-sunken/70 h-3 w-20 rounded-full" />
      </div>
      <div className="bg-sunken/70 h-7 w-20 rounded-full" />
    </div>
  );
}

export function PublicBoard() {
  const tools = useQuery(api.tools.listPublic);
  const [filter, setFilter] = useState<string>(ALL);

  const filtered = useMemo(() => {
    if (!tools) return [];
    if (filter === ALL) return tools;
    return tools.filter((tool) => tool.category === filter);
  }, [filter, tools]);

  return (
    <section
      id="board"
      className="border-line bg-surface scroll-mt-20 border-t py-20 md:py-28"
    >
      <div className="shell">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.55fr] lg:gap-16">
          <div className="max-w-md">
            <h2 className="text-3xl font-semibold tracking-[-0.035em] text-balance md:text-4xl">
              A live shelf for the neighborhood.
            </h2>
            <p className="text-muted mt-4 max-w-[38ch] text-[15px] leading-7">
              Every tool here is listed by a neighbor. Names and categories are public;
              owner details never appear on this public view.
            </p>
            <div className="text-faint mt-8 flex items-center gap-2 text-xs">
              <MagnifyingGlass size={15} />
              <span>
                {tools ? `${tools.length} tools visible today` : "Reading the board…"}
              </span>
            </div>
            <Link
              href="#how"
              className="text-moss mt-8 inline-flex items-center gap-2 text-sm font-medium transition hover:gap-3"
            >
              See how the loop works
              <ArrowRight size={15} weight="bold" />
            </Link>
          </div>

          <div>
            <div
              className="mb-6 flex flex-wrap gap-2"
              role="group"
              aria-label="Filter by category"
            >
              {[ALL, ...CATEGORIES].map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setFilter(category)}
                  aria-pressed={filter === category}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-xs transition",
                    filter === category
                      ? "border-moss bg-moss text-on-moss"
                      : "border-line bg-paper text-muted hover:border-faint hover:text-ink",
                  )}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="border-line bg-paper rounded-card border px-5 sm:px-6">
              {!tools ? (
                <div>
                  {Array.from({ length: 5 }, (_, index) => (
                    <SkeletonRow key={index} index={index} />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-ink text-sm font-medium">
                    Nothing on the shelf yet.
                  </p>
                  <p className="text-muted mt-2 text-sm">
                    Try another category, or be the first to list one.
                  </p>
                </div>
              ) : (
                <ul>
                  {filtered.map((tool, index) => (
                    <li
                      key={`${tool.name}-${tool.category}-${index}`}
                      className="group border-line/80 flex items-center justify-between gap-4 border-b py-4 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <p className="text-ink truncate text-[15px] font-medium">
                          {tool.name}
                        </p>
                        <p className="text-faint mt-0.5 text-xs">{tool.category}</p>
                      </div>
                      <span className="border-line bg-surface text-muted shrink-0 rounded-full border px-2.5 py-1 text-[11px]">
                        Available
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-faint mt-4 text-[11px] leading-5">
              Public view shows tool names and categories only. No addresses, emails, or
              owner names are exposed here.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
