"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { MagnifyingGlass, Toolbox } from "@phosphor-icons/react";
import { api } from "@/convex/_generated/api";
import { CATEGORIES } from "@/convex/lib/constants";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";
import { PageHeader } from "./page-header";
import { ToolCard } from "./tool-card";

const ALL = "All tools";

function CardSkeleton() {
  return (
    <div className="border-line bg-surface rounded-card border p-5">
      <div className="flex justify-between gap-3">
        <div className="bg-sunken h-6 w-28 rounded-full" />
        <div className="bg-sunken h-6 w-20 rounded-full" />
      </div>
      <div className="bg-sunken mt-5 h-4 w-2/3 rounded-full" />
      <div className="mt-3 space-y-2">
        <div className="bg-sunken/80 h-3 w-full rounded-full" />
        <div className="bg-sunken/70 h-3 w-5/6 rounded-full" />
      </div>
      <div className="bg-line mt-6 h-px w-full" />
      <div className="bg-sunken mt-4 h-8 w-24 rounded-full" />
    </div>
  );
}

export function BrowseView() {
  const [category, setCategory] = useState(ALL);
  const tools = useQuery(api.tools.list, {
    category: category === ALL ? undefined : category,
  });

  const availableCount = useMemo(
    () => tools?.filter((tool) => !tool.onLoanNow).length ?? 0,
    [tools],
  );

  return (
    <div className="space-y-7">
      <PageHeader
        title="The board"
        description="Borrow what you need from a neighbor. Every listing shows its condition and current availability; signed-in neighbors can see who listed it, while emails stay private."
        action={
          <div className="border-line bg-surface text-muted flex items-center gap-2 rounded-full border px-4 py-2 text-xs">
            <span className="bg-moss size-1.5 rounded-full" />
            {tools ? `${availableCount} available now` : "Reading the board"}
          </div>
        }
      />

      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Filter tools"
      >
        {[ALL, ...CATEGORIES].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            aria-pressed={category === item}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs transition",
              category === item
                ? "border-moss bg-moss text-on-moss"
                : "border-line bg-surface text-muted hover:border-faint hover:text-ink",
            )}
          >
            {item}
          </button>
        ))}
      </div>

      {!tools ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      ) : tools.length === 0 ? (
        <EmptyState
          icon={Toolbox}
          title="No tools in this category yet."
          body="Try another filter, or list something from your own shelf so a neighbor can find it."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool) => (
            <ToolCard key={tool._id} tool={tool} />
          ))}
        </div>
      )}

      <p className="text-faint flex items-center gap-2 text-[11px] leading-5">
        <MagnifyingGlass size={14} />
        Availability is calculated from approved loans. A pending request does not block
        other dates.
      </p>
    </div>
  );
}
