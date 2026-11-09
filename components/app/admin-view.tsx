"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  BellRinging,
  CheckCircle,
  SealCheck,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getErrorMessage } from "@/lib/errors";
import { formatDateRange, relativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./empty-state";
import { PageHeader } from "./page-header";
import { StatusBadge } from "./status-badge";
import { useViewer } from "./workspace";

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="border-line bg-surface rounded-field border p-4">
      <p className="text-faint text-[10px] tracking-[0.14em] uppercase">{label}</p>
      <p className="text-ink mt-2 font-mono text-2xl tracking-[-0.05em]">{value}</p>
      <p className="text-muted mt-1 text-[11px] leading-4">{detail}</p>
    </div>
  );
}

function Section({
  title,
  count,
  children,
  action,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="border-line bg-surface rounded-card border">
      <div className="border-line flex items-center justify-between gap-3 border-b px-5 py-4">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]">
          {title}
          {typeof count === "number" ? (
            <span className="bg-sunken text-muted rounded-full px-2 py-0.5 font-mono text-[10px]">
              {count}
            </span>
          ) : null}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function AdminDashboard() {
  const data = useQuery(api.admin.overview);
  const resolveIncident = useMutation(api.admin.resolveIncident);
  const setTrustedLender = useMutation(api.users.setTrustedLender);
  const [pendingIncident, setPendingIncident] = useState<string | null>(null);
  const [pendingMember, setPendingMember] = useState<string | null>(null);

  async function handleResolve(incidentId: Id<"automationIncidents">) {
    setPendingIncident(incidentId);
    try {
      await resolveIncident({ incidentId });
      toast.success("Incident resolved.");
    } catch (cause) {
      toast.error(getErrorMessage(cause, "Could not resolve the incident."));
    } finally {
      setPendingIncident(null);
    }
  }

  async function handleTrust(userId: Id<"users">, trusted: boolean) {
    setPendingMember(userId);
    try {
      await setTrustedLender({ userId, trusted });
      toast.success(trusted ? "Marked as trusted lender." : "Trusted status removed.");
    } catch (cause) {
      toast.error(getErrorMessage(cause, "Could not update this member."));
    } finally {
      setPendingMember(null);
    }
  }

  if (!data) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="border-line bg-surface rounded-field h-28 border p-4"
          >
            <div className="bg-sunken h-3 w-20 rounded-full" />
            <div className="bg-sunken mt-4 h-7 w-12 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  const loans = data.recentLoans;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Members" value={data.stats.users} detail="Profiles created" />
        <Metric label="Trusted" value={data.stats.lenders} detail="Verified lenders" />
        <Metric label="Listings" value={data.stats.activeTools} detail="Active tools" />
        <Metric
          label="Pending"
          value={data.stats.pendingRequests}
          detail="Awaiting a decision"
        />
        <Metric label="On loan" value={data.stats.activeLoans} detail="Out today" />
        <Metric
          label="Overdue"
          value={data.stats.overdueLoans}
          detail="Past return date"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
        <Section
          title="Automation incidents"
          count={data.incidents.length}
          action={
            <span className="text-faint text-[11px]">From n8n error workflow</span>
          }
        >
          {data.incidents.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <CheckCircle size={20} className="text-moss mx-auto" />
              <p className="mt-3 text-sm font-medium">No open incidents.</p>
              <p className="text-muted mt-1 text-xs">
                Every signed workflow call completed or retried cleanly.
              </p>
            </div>
          ) : (
            <ul className="divide-line divide-y">
              {data.incidents.map((incident) => (
                <li key={incident._id} className="flex items-start gap-3 px-5 py-4">
                  <WarningCircle size={18} className="text-clay mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13px] font-medium">{incident.workflow}</p>
                      <span className="text-faint font-mono text-[10px]">
                        {incident.executionId.slice(0, 12)}
                      </span>
                    </div>
                    <p className="text-muted mt-1 text-xs leading-5">
                      {incident.message}
                    </p>
                    <p className="text-faint mt-1.5 text-[10px]">
                      {incident.node ? `${incident.node} · ` : ""}
                      {relativeTime(incident.createdAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleResolve(incident._id)}
                    disabled={pendingIncident === incident._id}
                  >
                    {pendingIncident === incident._id ? "Resolving…" : "Resolve"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Failed notifications" count={data.failedEvents.length}>
          {data.failedEvents.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <BellRinging size={20} className="text-moss mx-auto" />
              <p className="mt-3 text-sm font-medium">No failed deliveries.</p>
              <p className="text-muted mt-1 text-xs">
                Outbound requests are retried up to four times.
              </p>
            </div>
          ) : (
            <ul className="divide-line divide-y">
              {data.failedEvents.map((event) => (
                <li key={event._id} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium">{event.type}</p>
                    <Badge tone="clay">Failed</Badge>
                  </div>
                  <p className="text-muted mt-1 text-[11px]">{event.toolName}</p>
                  <p className="text-faint mt-1.5 line-clamp-2 text-[10px] leading-4">
                    {event.lastError ?? "No error detail"}
                  </p>
                  <p className="text-faint mt-1 text-[10px]">
                    {event.attempts} attempts · {relativeTime(event.updatedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section
        title="All loans"
        count={loans.length}
        action={
          <span className="text-faint text-[11px]">Most recent {loans.length}</span>
        }
      >
        {loans.length === 0 ? (
          <div className="text-muted px-5 py-10 text-center text-sm">No loans yet.</div>
        ) : (
          <div className="max-h-[28rem] overflow-auto">
            <ul className="divide-line divide-y">
              {loans.map((loan) => (
                <li
                  key={loan._id}
                  className="grid gap-2 px-5 py-3.5 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[13px] font-medium">
                        {loan.toolName}
                      </p>
                      <StatusBadge status={loan.status} />
                    </div>
                    <p className="text-muted mt-0.5 text-[11px]">
                      {loan.ownerName} <ArrowRight size={11} className="inline" />{" "}
                      {loan.borrowerName} ·{" "}
                      {formatDateRange(loan.startDate, loan.endDate)}
                    </p>
                  </div>
                  {loan.note ? (
                    <p className="text-faint max-w-72 truncate text-[11px] sm:text-right">
                      {loan.note}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <Section title="Members" count={data.members.length}>
          <div className="max-h-80 overflow-auto">
            <ul className="divide-line divide-y">
              {data.members.map((member) => (
                <li key={member._id} className="flex items-center gap-3 px-5 py-3">
                  <div className="bg-sunken text-muted grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-medium">
                    {member.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{member.name}</p>
                    <p className="text-faint truncate text-[11px]">{member.email}</p>
                  </div>
                  {member.role === "admin" ? <Badge tone="quiet">Admin</Badge> : null}
                  <Button
                    variant={member.trustedLender ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => void handleTrust(member._id, !member.trustedLender)}
                    disabled={pendingMember === member._id}
                  >
                    {member.trustedLender ? (
                      <>
                        <SealCheck size={14} weight="fill" className="text-moss" />
                        Trusted
                      </>
                    ) : (
                      "Mark trusted"
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section title="Recent audit trail">
          {data.audits.length === 0 ? (
            <p className="text-muted px-5 py-10 text-center text-sm">
              No activity yet.
            </p>
          ) : (
            <ul className="divide-line divide-y">
              {data.audits.map((entry) => (
                <li
                  key={entry._id}
                  className="flex items-start justify-between gap-3 px-5 py-3"
                >
                  <div>
                    <p className="text-ink font-mono text-[11px]">{entry.action}</p>
                    <p className="text-faint mt-0.5 text-[10px]">
                      {entry.entityType} · {entry.entityId.slice(0, 10)}
                    </p>
                  </div>
                  <span className="text-faint shrink-0 text-[10px]">
                    {relativeTime(entry.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}

export function AdminView() {
  const viewer = useViewer();

  if (viewer.role !== "admin") {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Admin access only."
        body="This area is limited to LendLoop administrators. The same rule is enforced in Convex, not just the interface."
      />
    );
  }

  return (
    <div className="space-y-7">
      <PageHeader
        title="Admin"
        description="Loans, trusted lenders, and the automation trail. Actions here are audited."
        action={
          <div className="border-line bg-surface text-muted flex items-center gap-2 rounded-full border px-4 py-2 text-xs">
            <ShieldCheck size={15} className="text-moss" />
            Admin session
          </div>
        }
      />
      <AdminDashboard />
    </div>
  );
}
