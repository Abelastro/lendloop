"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { ArrowRight, Tray } from "@phosphor-icons/react";
import { api } from "@/convex/_generated/api";
import { cn, isActiveLoanStatus } from "@/lib/utils";
import { EmptyState } from "./empty-state";
import { LoanCard } from "./loan-card";
import { PageHeader } from "./page-header";

type Filter = "pending" | "active" | "all";

export function IncomingView() {
  const loans = useQuery(api.loans.listIncoming);
  const [filter, setFilter] = useState<Filter>("pending");

  const counts = useMemo(() => {
    const all = loans ?? [];
    return {
      total: all.length,
      pending: all.filter((loan) => loan.status === "pending").length,
      active: all.filter((loan) => isActiveLoanStatus(loan.status)).length,
    };
  }, [loans]);

  const visible = useMemo(() => {
    if (!loans) return [];
    if (filter === "pending") {
      return loans.filter((loan) => loan.status === "pending");
    }
    if (filter === "active") {
      return loans.filter((loan) => isActiveLoanStatus(loan.status));
    }
    return loans;
  }, [filter, loans]);

  return (
    <div className="space-y-7">
      <PageHeader
        title="Incoming requests"
        description="Requests for the tools you own. Approve only dates you can honor, then mark the loan returned when it comes home."
        action={
          <Link
            href="/app/listings"
            className="border-line bg-surface text-ink hover:border-faint hover:bg-sunken inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition"
          >
            Manage listings
            <ArrowRight size={15} />
          </Link>
        }
      />

      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Filter incoming requests"
      >
        {[
          {
            value: "pending" as const,
            label: "Needs a decision",
            count: counts.pending,
          },
          { value: "active" as const, label: "Active", count: counts.active },
          { value: "all" as const, label: "All", count: counts.total },
        ].map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setFilter(tab.value)}
            aria-pressed={filter === tab.value}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
              filter === tab.value
                ? "border-moss bg-moss text-on-moss"
                : "border-line bg-surface text-muted hover:border-faint hover:text-ink",
            )}
          >
            {tab.label} {tab.count}
          </button>
        ))}
      </div>

      {!loans ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="border-line bg-surface rounded-card border p-5">
              <div className="bg-sunken h-5 w-28 rounded-full" />
              <div className="bg-sunken mt-4 h-4 w-1/3 rounded-full" />
              <div className="bg-sunken/70 mt-3 h-3 w-1/4 rounded-full" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Tray}
          title={
            filter === "pending" ? "Nothing needs a decision." : "No incoming requests."
          }
          body={
            filter === "pending"
              ? "You're all caught up. New requests will land here and trigger a signed notification."
              : "When a neighbor asks for one of your tools, the request will show up here."
          }
          action={
            <Link
              href="/app/listings"
              className="border-line bg-surface text-ink hover:border-faint hover:bg-sunken inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition"
            >
              Check my listings
              <ArrowRight size={15} />
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((loan) => (
            <LoanCard key={loan._id} loan={loan} perspective="incoming" />
          ))}
        </div>
      )}
    </div>
  );
}
