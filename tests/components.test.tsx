import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActivityLine } from "../components/app/activity-line";
import { StatusBadge } from "../components/app/status-badge";
import type { ActivityItem } from "../lib/types";

describe("status badge", () => {
  it("renders human labels for every loan status", () => {
    expect(renderToStaticMarkup(<StatusBadge status="pending" />)).toContain("Pending");
    expect(renderToStaticMarkup(<StatusBadge status="approved" />)).toContain(
      "Approved",
    );
    expect(renderToStaticMarkup(<StatusBadge status="returned" />)).toContain(
      "Returned",
    );
  });
});

describe("activity line", () => {
  it("renders delivery state for automation events", () => {
    const item: ActivityItem = {
      id: "event-1",
      source: "automation",
      eventType: "request.approved",
      deliveryStatus: "delivered",
      channel: "email",
      createdAt: Date.now(),
    };
    const html = renderToStaticMarkup(<ActivityLine item={item} />);
    expect(html).toContain("Approval notification");
    expect(html).toContain("sent");
  });

  it("renders failed reminder delivery", () => {
    const item: ActivityItem = {
      id: "reminder-1",
      source: "reminder",
      eventType: "reminder.overdue",
      deliveryStatus: "failed",
      createdAt: Date.now(),
    };
    const html = renderToStaticMarkup(<ActivityLine item={item} />);
    expect(html).toContain("Reminder");
    expect(html).toContain("failed");
  });
});
