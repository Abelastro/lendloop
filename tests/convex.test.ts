// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { createSignatureHeaders } from "../convex/lib/crypto";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");

const aliceEmail = ["alice", "example.test"].join("@");
const bobEmail = ["bob", "example.test"].join("@");
const adminEmail = ["admin", "example.test"].join("@");
const testSecret = ["http", "test", "secret"].join("-");

const aliceIdentity = {
  subject: "user_alice",
  email: aliceEmail,
  emailVerified: true,
  name: "Alice",
};
const bobIdentity = {
  subject: "user_bob",
  email: bobEmail,
  emailVerified: true,
  name: "Bob",
};
const adminIdentity = {
  subject: "user_admin",
  email: adminEmail,
  emailVerified: true,
  name: "Admin",
};

function setup() {
  delete process.env.N8N_WEBHOOK_URL;
  delete process.env.ADMIN_EMAILS;
  return convexTest(schema, modules);
}

async function ensureUser(t: ReturnType<typeof setup>, identity: typeof aliceIdentity) {
  return await t.withIdentity(identity).mutation(api.users.ensureViewer, {});
}

async function createTool(
  t: ReturnType<typeof setup>,
  identity: typeof aliceIdentity,
  name = "Cordless drill",
) {
  return await t.withIdentity(identity).mutation(api.tools.create, {
    name,
    category: "Power tools",
    condition: "good",
    description: "18V drill with two batteries and a case.",
  });
}

describe("viewer bootstrap", () => {
  it("rejects identities without a verified email", async () => {
    const t = setup();
    const unverified = t.withIdentity({
      ...aliceIdentity,
      emailVerified: false,
    });
    await expect(unverified.mutation(api.users.ensureViewer, {})).rejects.toThrow(
      /verify your email/i,
    );

    const missing = t.withIdentity({ ...aliceIdentity, email: undefined });
    await expect(missing.mutation(api.users.ensureViewer, {})).rejects.toThrow(
      /missing an email/i,
    );
  });

  it("creates a member and elevates verified ADMIN_EMAILS users", async () => {
    const t = setup();
    const alice = await ensureUser(t, aliceIdentity);
    expect(alice!.role).toBe("user");
    expect(alice!.trustedLender).toBe(false);

    process.env.ADMIN_EMAILS = adminIdentity.email;
    const admin = await ensureUser(t, adminIdentity);
    expect(admin!.role).toBe("admin");
    delete process.env.ADMIN_EMAILS;
  });

  it("keeps an existing admin role when the email leaves ADMIN_EMAILS", async () => {
    const t = setup();
    process.env.ADMIN_EMAILS = adminIdentity.email;
    const admin = await ensureUser(t, adminIdentity);
    expect(admin!.role).toBe("admin");
    delete process.env.ADMIN_EMAILS;

    const again = await ensureUser(t, adminIdentity);
    expect(again!.role).toBe("admin");
  });
});

describe("tool visibility and ownership", () => {
  it("returns only name and category from the public query", async () => {
    const t = setup();
    await ensureUser(t, aliceIdentity);
    await ensureUser(t, bobIdentity);
    const toolId = await createTool(t, aliceIdentity);

    const publicTools = await t.query(api.tools.listPublic, {});
    expect(publicTools).toHaveLength(1);
    expect(Object.keys(publicTools[0]!).sort()).toEqual(["category", "name"]);

    const memberTools = await t.withIdentity(bobIdentity).query(api.tools.list, {});
    expect(memberTools[0]!._id).toBe(toolId);
    expect(memberTools[0]!.ownerName).toBe("Alice");
  });

  it("enforces owner-only edits and admin removal", async () => {
    const t = setup();
    await ensureUser(t, aliceIdentity);
    const toolId = await createTool(t, aliceIdentity);
    await ensureUser(t, bobIdentity);

    await expect(
      t.withIdentity(bobIdentity).mutation(api.tools.update, {
        toolId,
        name: "Bob's drill",
        category: "Power tools",
        condition: "good",
        description: "Attempting to edit someone else's listing.",
      }),
    ).rejects.toThrow(/only edit your own/i);

    process.env.ADMIN_EMAILS = adminIdentity.email;
    await ensureUser(t, adminIdentity);
    delete process.env.ADMIN_EMAILS;

    await t.withIdentity(adminIdentity).mutation(api.tools.remove, { toolId });
    const publicTools = await t.query(api.tools.listPublic, {});
    expect(publicTools).toHaveLength(0);
  });
});

describe("loan lifecycle and RBAC", () => {
  it("runs request, approve, and return with ownership checks", async () => {
    const t = setup();
    await ensureUser(t, aliceIdentity);
    await ensureUser(t, bobIdentity);
    const toolId = await createTool(t, aliceIdentity);

    const loanId = await t.withIdentity(bobIdentity).mutation(api.loans.request, {
      toolId,
      startDate: "2099-01-01",
      endDate: "2099-01-03",
      note: "Weekend project.",
    });

    await expect(
      t.withIdentity(bobIdentity).mutation(api.loans.approve, { loanId }),
    ).rejects.toThrow(/only the lender/i);

    await t.withIdentity(aliceIdentity).mutation(api.loans.approve, { loanId });
    let loan = await t.run(async (ctx) => await ctx.db.get(loanId));
    expect(loan?.status).toBe("approved");

    await expect(
      t.withIdentity(aliceIdentity).mutation(api.loans.cancel, { loanId }),
    ).rejects.toThrow(/only the borrower/i);

    await t.withIdentity(bobIdentity).mutation(api.loans.markReturned, { loanId });
    loan = await t.run(async (ctx) => await ctx.db.get(loanId));
    const bob = await t.run(
      async (ctx) =>
        await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", bobIdentity.subject))
          .unique(),
    );
    expect(loan?.status).toBe("returned");
    expect(loan?.returnedBy).toBe(bob?._id);
  });

  it("rejects self-requests and overlapping windows", async () => {
    const t = setup();
    await ensureUser(t, aliceIdentity);
    await ensureUser(t, bobIdentity);
    const toolId = await createTool(t, aliceIdentity);

    await expect(
      t.withIdentity(aliceIdentity).mutation(api.loans.request, {
        toolId,
        startDate: "2099-02-01",
        endDate: "2099-02-02",
      }),
    ).rejects.toThrow(/own tool/i);

    await t.withIdentity(bobIdentity).mutation(api.loans.request, {
      toolId,
      startDate: "2099-02-01",
      endDate: "2099-02-03",
    });

    await expect(
      t.withIdentity(bobIdentity).mutation(api.loans.request, {
        toolId,
        startDate: "2099-02-02",
        endDate: "2099-02-04",
      }),
    ).rejects.toThrow(/overlap/i);
  });
});

describe("reminder write-back idempotency", () => {
  it("accepts one reminder per loan and UTC run date", async () => {
    const t = setup();
    await ensureUser(t, aliceIdentity);
    await ensureUser(t, bobIdentity);
    const toolId = await createTool(t, aliceIdentity);
    const loanId = await t.withIdentity(bobIdentity).mutation(api.loans.request, {
      toolId,
      startDate: "2099-03-01",
      endDate: "2099-03-02",
    });
    await t.withIdentity(aliceIdentity).mutation(api.loans.approve, { loanId });

    const args = {
      date: "2099-03-03",
      reminders: [{ loanId, channel: "mock", status: "sent" as const }],
    };
    const first = await t.mutation(internal.automations.recordReminders, args);
    expect(first).toEqual({ accepted: 1, skipped: 0 });

    const second = await t.mutation(internal.automations.recordReminders, args);
    expect(second).toEqual({ accepted: 0, skipped: 1 });
  });

  it("skips reminders for loans that are not approved", async () => {
    const t = setup();
    await ensureUser(t, aliceIdentity);
    await ensureUser(t, bobIdentity);
    const toolId = await createTool(t, aliceIdentity);
    const loanId = await t.withIdentity(bobIdentity).mutation(api.loans.request, {
      toolId,
      startDate: "2099-04-01",
      endDate: "2099-04-02",
    });

    const result = await t.mutation(internal.automations.recordReminders, {
      date: "2099-04-03",
      reminders: [{ loanId, channel: "mock", status: "sent" as const }],
    });
    expect(result).toEqual({ accepted: 0, skipped: 1 });
  });
});

describe("signed request guards", () => {
  it("detects duplicate and in-progress replay keys", async () => {
    const t = setup();
    const now = Date.now();
    const first = await t.mutation(internal.guards.beginSignedRequest, {
      key: "test-key",
      route: "reminders",
      applyReplay: true,
      now,
    });
    expect(first.ok).toBe(true);

    const inProgress = await t.mutation(internal.guards.beginSignedRequest, {
      key: "test-key",
      route: "reminders",
      applyReplay: true,
      now,
    });
    expect(inProgress).toEqual({ ok: false, reason: "in_progress" });

    await t.mutation(internal.guards.finishSignedRequest, {
      key: "test-key",
      status: "completed",
      now,
    });
    const duplicate = await t.mutation(internal.guards.beginSignedRequest, {
      key: "test-key",
      route: "reminders",
      applyReplay: true,
      now,
    });
    expect(duplicate).toEqual({ ok: false, reason: "duplicate" });
  });

  it("rate limits a route to sixty requests per minute", async () => {
    const t = setup();
    const now = Date.now();
    for (let index = 0; index < 60; index += 1) {
      const result = await t.mutation(internal.guards.beginSignedRequest, {
        key: `rate-${index}`,
        route: "rate-test",
        applyReplay: false,
        now,
      });
      expect(result.ok).toBe(true);
    }
    const blocked = await t.mutation(internal.guards.beginSignedRequest, {
      key: "rate-61",
      route: "rate-test",
      applyReplay: false,
      now,
    });
    expect(blocked).toEqual({ ok: false, reason: "rate_limited" });
  });
});

describe("signed HTTP endpoints", () => {
  it("rejects unsigned requests and accepts signed reminder batches", async () => {
    const t = setup();
    await ensureUser(t, aliceIdentity);
    await ensureUser(t, bobIdentity);
    const toolId = await createTool(t, aliceIdentity);
    const loanId = await t.withIdentity(bobIdentity).mutation(api.loans.request, {
      toolId,
      startDate: "2099-05-01",
      endDate: "2099-05-02",
    });
    await t.withIdentity(aliceIdentity).mutation(api.loans.approve, { loanId });

    process.env["N8N_INBOUND_SECRET"] = testSecret;
    const unsigned = await t.fetch("/n8n/reminders", {
      method: "POST",
      body: JSON.stringify({ reminders: [] }),
    });
    expect(unsigned.status).toBe(401);

    const body = JSON.stringify({
      date: "2099-05-03",
      reminders: [{ loanId, channel: "mock", status: "sent" }],
    });
    const headers = await createSignatureHeaders(testSecret, body, "http-reminder-1");
    const signed = await t.fetch("/n8n/reminders", {
      method: "POST",
      headers,
      body,
    });
    expect(signed.status).toBe(200);
    await expect(signed.json()).resolves.toEqual({ accepted: 1, skipped: 0 });

    const replay = await t.fetch("/n8n/reminders", {
      method: "POST",
      headers,
      body,
    });
    expect(replay.status).toBe(200);
    await expect(replay.json()).resolves.toEqual({ ok: true, duplicate: true });

    delete process.env.N8N_INBOUND_SECRET;
  });

  it("serves signed overdue queries and returns 503 without a secret", async () => {
    const t = setup();
    delete process.env.N8N_INBOUND_SECRET;
    const notConfigured = await t.fetch("/n8n/overdue", { method: "GET" });
    expect(notConfigured.status).toBe(503);

    process.env["N8N_INBOUND_SECRET"] = testSecret;
    const headers = await createSignatureHeaders(testSecret, "", "overdue-1");
    const response = await t.fetch("/n8n/overdue", { method: "GET", headers });
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { loans: unknown[] };
    expect(payload.loans).toEqual([]);
    delete process.env.N8N_INBOUND_SECRET;
  });

  it("records incidents idempotently", async () => {
    const t = setup();
    process.env["N8N_INBOUND_SECRET"] = testSecret;
    const body = JSON.stringify({
      workflow: "test-workflow",
      executionId: "exec-1",
      message: "Slack webhook failed",
    });
    const headers = await createSignatureHeaders(testSecret, body, "incident-exec-1");
    const first = await t.fetch("/n8n/incidents", { method: "POST", headers, body });
    expect(first.status).toBe(200);
    const second = await t.fetch("/n8n/incidents", { method: "POST", headers, body });
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toEqual({ ok: true, duplicate: true });
    const incidents = await t.run(async (ctx) =>
      ctx.db.query("automationIncidents").take(10),
    );
    expect(incidents).toHaveLength(1);
    delete process.env.N8N_INBOUND_SECRET;
  });
});

describe("admin console", () => {
  it("requires an admin role", async () => {
    const t = setup();
    await ensureUser(t, aliceIdentity);
    await expect(
      t.withIdentity(aliceIdentity).query(api.admin.overview, {}),
    ).rejects.toThrow(/admin access/i);

    process.env.ADMIN_EMAILS = adminIdentity.email;
    await ensureUser(t, adminIdentity);
    delete process.env.ADMIN_EMAILS;
    const overview = await t.withIdentity(adminIdentity).query(api.admin.overview, {});
    expect(overview.stats.users).toBe(2);
  });
});
