import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const role = v.union(v.literal("user"), v.literal("admin"));
const toolCategory = v.union(
  v.literal("Garden & yard"),
  v.literal("Power tools"),
  v.literal("Hand tools"),
  v.literal("Home & kitchen"),
  v.literal("Outdoor & camping"),
  v.literal("Other"),
);
const toolCondition = v.union(
  v.literal("like_new"),
  v.literal("good"),
  v.literal("fair"),
  v.literal("well_used"),
);
const loanStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("cancelled"),
  v.literal("returned"),
);
const deliveryStatus = v.union(
  v.literal("pending"),
  v.literal("delivered"),
  v.literal("failed"),
  v.literal("skipped"),
);
const reminderStatus = v.union(v.literal("sent"), v.literal("failed"));
const reminderChannel = v.union(
  v.literal("slack"),
  v.literal("email"),
  v.literal("mock"),
  v.literal("unknown"),
);
const automationEventType = v.union(
  v.literal("request.created"),
  v.literal("request.approved"),
  v.literal("request.declined"),
  v.literal("request.cancelled"),
  v.literal("loan.returned"),
);

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    role,
    trustedLender: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  tools: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    category: toolCategory,
    condition: toolCondition,
    description: v.string(),
    isRemoved: v.boolean(),
    removedAt: v.optional(v.number()),
    removedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_active", ["isRemoved"])
    .index("by_category", ["category"])
    .index("by_owner_active", ["ownerId", "isRemoved"]),

  loans: defineTable({
    toolId: v.id("tools"),
    ownerId: v.id("users"),
    borrowerId: v.id("users"),
    startDate: v.string(),
    endDate: v.string(),
    status: loanStatus,
    note: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    decidedAt: v.optional(v.number()),
    returnedAt: v.optional(v.number()),
    returnedBy: v.optional(v.id("users")),
  })
    .index("by_tool", ["toolId"])
    .index("by_owner", ["ownerId"])
    .index("by_borrower", ["borrowerId"])
    .index("by_status", ["status"])
    .index("by_status_end_date", ["status", "endDate"])
    .index("by_tool_status", ["toolId", "status"])
    .index("by_borrower_status", ["borrowerId", "status"])
    .index("by_created_at", ["createdAt"]),

  reminders: defineTable({
    loanId: v.id("loans"),
    dedupeKey: v.string(),
    channel: reminderChannel,
    recipientId: v.id("users"),
    status: reminderStatus,
    sentAt: v.number(),
    providerMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_loan", ["loanId"])
    .index("by_dedupe_key", ["dedupeKey"])
    .index("by_loan_sent_at", ["loanId", "sentAt"]),

  automationEvents: defineTable({
    loanId: v.optional(v.id("loans")),
    type: automationEventType,
    idempotencyKey: v.string(),
    actorId: v.optional(v.id("users")),
    actorName: v.string(),
    recipientId: v.id("users"),
    recipientName: v.string(),
    toolName: v.string(),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    loanStatus: v.optional(loanStatus),
    deliveryStatus,
    workflow: v.optional(v.string()),
    attempts: v.number(),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deliveredAt: v.optional(v.number()),
  })
    .index("by_loan", ["loanId"])
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_delivery_status", ["deliveryStatus"])
    .index("by_created_at", ["createdAt"]),

  auditLogs: defineTable({
    actorId: v.optional(v.id("users")),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    metadata: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_actor", ["actorId"])
    .index("by_entity", ["entityType", "entityId"])
    .index("by_created_at", ["createdAt"]),

  automationIncidents: defineTable({
    idempotencyKey: v.string(),
    workflow: v.string(),
    executionId: v.string(),
    node: v.optional(v.string()),
    message: v.string(),
    resolvedAt: v.optional(v.number()),
    resolvedBy: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_created_at", ["createdAt"])
    .index("by_resolved_at", ["resolvedAt"]),

  signedRequestReplays: defineTable({
    key: v.string(),
    route: v.string(),
    status: v.union(
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_expires_at", ["expiresAt"]),

  webhookRateLimits: defineTable({
    bucket: v.string(),
    count: v.number(),
    updatedAt: v.number(),
  }).index("by_bucket", ["bucket"]),
});
