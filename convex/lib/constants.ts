export const CATEGORIES = [
  "Garden & yard",
  "Power tools",
  "Hand tools",
  "Home & kitchen",
  "Outdoor & camping",
  "Other",
] as const;

export type ToolCategory = (typeof CATEGORIES)[number];

export const CONDITIONS = ["like_new", "good", "fair", "well_used"] as const;
export type ToolCondition = (typeof CONDITIONS)[number];

export const CONDITION_LABELS: Record<ToolCondition, string> = {
  like_new: "Like new",
  good: "Good",
  fair: "Fair",
  well_used: "Well used",
};

export const LOAN_STATUSES = [
  "pending",
  "approved",
  "declined",
  "cancelled",
  "returned",
] as const;

export type LoanStatus = (typeof LOAN_STATUSES)[number];

export const MAX_TOOL_NAME = 80;
export const MAX_TOOL_DESCRIPTION = 280;
export const MAX_LOAN_NOTE = 240;
export const MAX_LOAN_DAYS = 60;
export const MAX_ACTIVE_LISTINGS = 30;
export const MAX_PENDING_REQUESTS = 5;
export const REQUEST_WINDOW_MS = 60 * 60 * 1000;
export const MAX_REQUESTS_PER_HOUR = 10;
export const MAX_LISTINGS_PER_HOUR = 10;
export const REMINDER_DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

export const AUTOMATION_MAX_ATTEMPTS = 4;

export const AUTOMATION_EVENT_TYPES = [
  "request.created",
  "request.approved",
  "request.declined",
  "request.cancelled",
  "loan.returned",
] as const;

export type AutomationEventType = (typeof AUTOMATION_EVENT_TYPES)[number];

export const ACTIVITY_EVENT_TYPES = [
  ...AUTOMATION_EVENT_TYPES,
  "reminder.overdue",
] as const;

export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

export const DELIVERY_STATUSES = ["pending", "delivered", "failed", "skipped"] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export type ReminderStatus = "sent" | "failed";
export type ActivityDeliveryStatus = DeliveryStatus | ReminderStatus;
