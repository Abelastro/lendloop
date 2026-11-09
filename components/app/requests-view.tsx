"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { ArrowRight, PaperPlaneTilt } from "@phosphor-icons/react";
import { api } from "@/convex/_generated/api";
import { cn, isActiveLoanStatus } from "@/lib/utils";
import { EmptyState } from "./empty-state";
import { LoanCard } from "./loan-card";
import { PageHeader } from "./page-header";

type Filter = "active" | "all";

function FilterTabs({
  value,
  onChange,
  activeCount,
  totalCount,
  activeLabel,
}: {
  value: Filter;
  onChange: (value: Filter) => void;
  activeCount: number;
  totalCount: number;
  activeLabel: string;
}) {
  return (
    <div className="border-line bg-surface flex gap-1 rounded-full border p-1">
      <button
        type="button"
        onClick={() => onChange("active")}
        aria-pressed={value === "active"}
        className={cn(
          "rounded-full px-3.5 py-1.5 text-xs font-medium transition",
          value === "active" ? "bg-moss text-on-moss" : "text-muted hover:text-ink",
        )}
      >
        {activeLabel} {activeCount}
      </button>
      <button
        type="button"
        onClick={() => onChange("all")}
        aria-pressed={value === "all"}
        className={cn(
          "rounded-full px-3.5 py-1.5 text-xs font-medium transition",
          value === "all" ? "bg-moss text-on-moss" : "text-muted hover:text-ink",
        )}
      >
        All {totalCount}
      </button>
    </div>
  );
}

function LoanSkeleton() {
  return (
    <div className="border-line bg-surface rounded-card border p-5">
      <div className="bg-sunken h-5 w-24 rounded-full" />
      <div className="bg-sunken mt-4 h-4 w-1/3 rounded-full" />
      <div className="bg-sunken/70 mt-2 h-3 w-1/4 rounded-full" />
      <div className="bg-line mt-5 h-px w-full" />
      <div className="bg-sunken mt-4 h-8 w-28 rounded-full" />
    </div>
  );
}

export function RequestsView() {
  const loans = useQuery(api.loans.listOutgoing);
  const [filter, setFilter] = useState<Filter>("active");

  const counts = useMemo(() => {
    const all = loans ?? [];
    return {
      total: all.length,
      active: all.filter((loan) => isActiveLoanStatus(loan.status)).length,
    };
  }, [loans]);

  const visible = useMemo(() => {
    if (!loans) return [];
    return filter === "active"
      ? loans.filter((loan) => isActiveLoanStatus(loan.status))
      : loans;
  }, [filter, loans]);

  return (
    <div className="space-y-7">
      <PageHeader
        title="My requests"
        description="Tools you've asked to borrow. A request is only confirmed when the lender approves it."
        action={
          <FilterTabs
            value={filter}
            onChange={setFilter}
            activeCount={counts.active}
            totalCount={counts.total}
            activeLabel="Active"
          />
        }
      />

      {!loans ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <LoanSkeleton key={index} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={PaperPlaneTilt}
          title={filter === "active" ? "No active requests." : "No requests yet."}
          body={
            filter === "active"
              ? "When you request a tool, it will appear here until the loan is returned or closed."
              : "Browse the board and ask for a date window. The lender decides, and the automation keeps you posted."
          }
          action={
            <Link
              href="/app"
              className="bg-moss text-on-moss hover:bg-moss-strong inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition"
            >
              Browse the board
              <ArrowRight size={15} weight="bold" />
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((loan) => (
            <LoanCard key={loan._id} loan={loan} perspective="outgoing" />
          ))}
        </div>
      )}
    </div>
  );
}
