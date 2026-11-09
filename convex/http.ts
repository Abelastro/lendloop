import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { REMINDER_DEDUPE_WINDOW_MS } from "./lib/constants";
import { isFreshTimestamp, verifySignature } from "./lib/crypto";
import { getInboundSigningKey, notificationRouting } from "./lib/env";
import { todayISO } from "./lib/validation";

const router = httpRouter();

const MAX_BODY_BYTES = 64 * 1024;

type ReminderWriteback = {
  loanId: string;
  channel: string;
  status: "sent" | "failed";
  sentAt?: number;
  providerMessageId?: string;
  error?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function unauthorized(message = "Unauthorized."): Response {
  return json(401, { error: message });
}

async function readSignedBody(request: Request): Promise<
  | {
      ok: true;
      body: string;
      idempotencyKey: string;
      timestamp: string;
      signature: string;
    }
  | { ok: false; response: Response }
> {
  const key = getInboundSigningKey();
  if (!key) {
    return {
      ok: false,
      response: json(503, { error: "Webhook signing is not configured." }),
    };
  }
  const timestamp = request.headers.get("x-lendloop-timestamp") ?? "";
  const signature = request.headers.get("x-lendloop-signature") ?? "";
  const idempotencyKey = request.headers.get("x-lendloop-idempotency-key") ?? "";
  if (!isFreshTimestamp(timestamp)) {
    return { ok: false, response: unauthorized("Stale or missing timestamp.") };
  }
  const declaredSize = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredSize) && declaredSize > MAX_BODY_BYTES) {
    return { ok: false, response: json(413, { error: "Payload too large." }) };
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return { ok: false, response: json(413, { error: "Payload too large." }) };
  }
  const valid = await verifySignature(key, timestamp, signature, raw);
  if (!valid) return { ok: false, response: unauthorized("Invalid signature.") };
  return { ok: true, body: raw, idempotencyKey, timestamp, signature };
}

function guardFailure(reason: "rate_limited" | "duplicate" | "in_progress"): Response {
  if (reason === "duplicate") {
    return json(200, { ok: true, duplicate: true });
  }
  if (reason === "in_progress") {
    return json(409, { error: "Request already in progress." });
  }
  return json(429, { error: "Too many signed requests." });
}

router.route({
  path: "/n8n/overdue",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const signed = await readSignedBody(request);
    if (!signed.ok) return signed.response;
    const guard = await ctx.runMutation(internal.guards.beginSignedRequest, {
      key: `sig:${signed.timestamp}:${signed.signature}`,
      route: "overdue",
      applyReplay: false,
    });
    if (!guard.ok) return guardFailure(guard.reason);
    const result = await ctx.runQuery(internal.automations.overdueLoans, {
      today: todayISO(),
      since: Date.now() - REMINDER_DEDUPE_WINDOW_MS,
      includeEmail: notificationRouting() === "email",
    });
    return json(200, result);
  }),
});

router.route({
  path: "/n8n/reminders",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const signed = await readSignedBody(request);
    if (!signed.ok) return signed.response;
    const key = signed.idempotencyKey || `sig:${signed.timestamp}:${signed.signature}`;
    const guard = await ctx.runMutation(internal.guards.beginSignedRequest, {
      key,
      route: "reminders",
      applyReplay: true,
    });
    if (!guard.ok) return guardFailure(guard.reason);
    const finish = (status: "completed" | "failed") =>
      ctx.runMutation(internal.guards.finishSignedRequest, { key, status });

    try {
      let payload: unknown;
      try {
        payload = JSON.parse(signed.body);
      } catch {
        await finish("completed");
        return json(400, { error: "Invalid JSON." });
      }
      if (!isRecord(payload)) {
        await finish("completed");
        return json(400, { error: "Expected a JSON object." });
      }
      const reminders = payload.reminders;
      if (!Array.isArray(reminders) || reminders.length > 100) {
        await finish("completed");
        return json(400, { error: "Expected 1-100 reminder results." });
      }
      const shaped: ReminderWriteback[] = [];
      for (const item of reminders) {
        if (!isRecord(item)) {
          await finish("completed");
          return json(400, { error: "Each reminder must be an object." });
        }
        shaped.push({
          loanId: typeof item.loanId === "string" ? item.loanId : "",
          channel: typeof item.channel === "string" ? item.channel : "mock",
          status: item.status === "failed" ? "failed" : "sent",
          sentAt: typeof item.sentAt === "number" ? item.sentAt : undefined,
          providerMessageId:
            typeof item.providerMessageId === "string"
              ? item.providerMessageId.slice(0, 120)
              : undefined,
          error: typeof item.error === "string" ? item.error.slice(0, 300) : undefined,
        });
      }
      const result = await ctx.runMutation(internal.automations.recordReminders, {
        date:
          typeof payload.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.date)
            ? payload.date
            : undefined,
        reminders: shaped,
      });
      await finish("completed");
      return json(200, result);
    } catch (error) {
      await finish("failed");
      throw error;
    }
  }),
});

router.route({
  path: "/n8n/incidents",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const signed = await readSignedBody(request);
    if (!signed.ok) return signed.response;
    const key = signed.idempotencyKey || `sig:${signed.timestamp}:${signed.signature}`;
    const guard = await ctx.runMutation(internal.guards.beginSignedRequest, {
      key,
      route: "incidents",
      applyReplay: true,
    });
    if (!guard.ok) return guardFailure(guard.reason);
    const finish = (status: "completed" | "failed") =>
      ctx.runMutation(internal.guards.finishSignedRequest, { key, status });

    try {
      let payload: unknown;
      try {
        payload = JSON.parse(signed.body);
      } catch {
        await finish("completed");
        return json(400, { error: "Invalid JSON." });
      }
      if (!isRecord(payload)) {
        await finish("completed");
        return json(400, { error: "Expected a JSON object." });
      }
      const workflow =
        typeof payload.workflow === "string" ? payload.workflow.trim() : "";
      const executionId =
        typeof payload.executionId === "string" ? payload.executionId.trim() : "";
      const message = typeof payload.message === "string" ? payload.message.trim() : "";
      if (!workflow || !executionId || !message) {
        await finish("completed");
        return json(400, { error: "workflow, executionId and message are required." });
      }
      const incidentId = await ctx.runMutation(internal.automations.recordIncident, {
        workflow,
        executionId,
        node: typeof payload.node === "string" ? payload.node : undefined,
        message,
        idempotencyKey: signed.idempotencyKey,
      });
      await finish("completed");
      return json(200, { id: incidentId });
    } catch (error) {
      await finish("failed");
      throw error;
    }
  }),
});

const http = router;

export default http;
