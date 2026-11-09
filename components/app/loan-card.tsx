"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { SealCheck } from "@phosphor-icons/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { getErrorMessage } from "@/lib/errors";
import type { LoanCardData } from "@/lib/types";
import { formatDateRange } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActivityLine } from "./activity-line";
import { useViewer } from "./workspace";
import { StatusBadge } from "./status-badge";

type Perspective = "outgoing" | "incoming" | "admin";

export function LoanCard({
  loan,
  perspective,
}: {
  loan: LoanCardData;
  perspective: Perspective;
}) {
  const viewer = useViewer();
  const approve = useMutation(api.loans.approve);
  const decline = useMutation(api.loans.decline);
  const cancel = useMutation(api.loans.cancel);
  const markReturned = useMutation(api.loans.markReturned);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const isOwner = viewer._id === loan.ownerId;
  const isBorrower = viewer._id === loan.borrowerId;
  const counterpart = perspective === "outgoing" ? loan.ownerName : loan.borrowerName;
  const counterpartLabel = perspective === "outgoing" ? "Lender" : "Borrower";

  async function run(action: string, fn: () => Promise<null>, success: string) {
    setPendingAction(action);
    try {
      await fn();
      toast.success(success);
    } catch (cause) {
      toast.error(getErrorMessage(cause, "That action could not be completed."));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <article className="border-line bg-surface rounded-card border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={loan.status} />
            <span className="text-faint text-[11px]">{loan.toolCategory}</span>
            {loan.toolRemoved ? <Badge tone="clay">Removed</Badge> : null}
          </div>
          <h2 className="mt-2.5 truncate text-[17px] font-semibold tracking-[-0.02em]">
            {loan.toolName}
          </h2>
          <p className="text-muted mt-1 text-sm">
            {formatDateRange(loan.startDate, loan.endDate)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-faint text-[10px] tracking-[0.14em] uppercase">
            {counterpartLabel}
          </p>
          <p className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium">
            {counterpart}
            {(perspective === "outgoing" ? loan.ownerTrusted : loan.borrowerTrusted) ? (
              <SealCheck size={14} weight="fill" className="text-moss" />
            ) : null}
          </p>
        </div>
      </div>

      {loan.note ? (
        <p className="border-line bg-sunken/55 text-muted rounded-field mt-4 border px-3.5 py-3 text-[13px] leading-6">
          {loan.note}
        </p>
      ) : null}

      {loan.activity.length > 0 ? (
        <div className="border-line mt-4 space-y-1 border-t pt-3.5">
          {loan.activity.slice(0, 2).map((item) => (
            <ActivityLine key={`${item.source}-${item.id}`} item={item} />
          ))}
        </div>
      ) : null}

      <div className="border-line mt-4 flex flex-wrap items-center justify-end gap-2 border-t pt-4">
        {perspective === "incoming" && loan.status === "pending" && isOwner ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                void run(
                  "decline",
                  () => decline({ loanId: loan._id }),
                  "Request declined.",
                )
              }
              disabled={pendingAction !== null}
            >
              Decline
            </Button>
            <Button
              size="sm"
              onClick={() =>
                void run(
                  "approve",
                  () => approve({ loanId: loan._id }),
                  "Request approved. The borrower has been notified.",
                )
              }
              disabled={pendingAction !== null}
            >
              {pendingAction === "approve" ? "Approving…" : "Approve"}
            </Button>
          </>
        ) : null}

        {perspective === "outgoing" &&
        isBorrower &&
        (loan.status === "pending" || loan.status === "approved") ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              void run(
                "cancel",
                () => cancel({ loanId: loan._id }),
                "Request cancelled.",
              )
            }
            disabled={pendingAction !== null}
          >
            {pendingAction === "cancel" ? "Cancelling…" : "Cancel request"}
          </Button>
        ) : null}

        {loan.status === "approved" && (isOwner || isBorrower) ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              void run(
                "return",
                () => markReturned({ loanId: loan._id }),
                "Loan marked returned.",
              )
            }
            disabled={pendingAction !== null}
          >
            {pendingAction === "return" ? "Closing…" : "Mark returned"}
          </Button>
        ) : null}

        {perspective === "admin" ? (
          <p className="text-faint mr-auto text-[11px]">
            Borrower {loan.borrowerName} · Lender {loan.ownerName}
          </p>
        ) : null}
      </div>
    </article>
  );
}
