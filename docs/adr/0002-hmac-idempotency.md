# ADR 0002: Two-direction HMAC signing with idempotent write-backs

- Status: Accepted
- Date: 2026-11-09

## Context

Convex and n8n exchange data across a trust boundary:

- Convex calls n8n when a request is created or changes status.
- n8n calls Convex to fetch overdue loans, write reminders back, and report incidents.

Both directions need authentication, replay resistance, bounded payloads, and retry
semantics. A shared secret in both directions would let a compromised notification
credential sign write-backs.

## Decision

Use two independent HMAC-SHA256 secrets:

| Direction    | Convex variable       | n8n variable               |
| ------------ | --------------------- | -------------------------- |
| Convex → n8n | `N8N_OUTBOUND_SECRET` | `LENDLOOP_INBOUND_SECRET`  |
| n8n → Convex | `N8N_INBOUND_SECRET`  | `LENDLOOP_OUTBOUND_SECRET` |

The canonical string is `${unixTimestampSeconds}.${rawBody}`. Signatures are lowercase
hex and verified with a constant-time comparison. Timestamps older than 300 seconds are
rejected, and request bodies are capped at 64 KB.

Idempotency is layered:

- Outbound automation events are unique on `type:loanId`.
- Incidents are unique on their n8n execution ID.
- Reminder write-backs are deduplicated by `overdue:{loanId}:{UTC run date}` and a
  rolling 24-hour per-loan window.
- Signed write-backs also pass through a short-lived replay guard and a fixed-window
  rate limit. A completed key returns a duplicate success, an in-flight key returns
  409, and an exhausted bucket returns 429.
- The overdue fetch is signed and rate-limited but does not consume the replay guard:
  it is a read, so a retry is safe.

Secrets live only in Convex deployment environment variables and n8n environment or
Cloud variables. Exported workflow JSON contains variable names, never values.

## Consequences

- A leaked notification secret cannot forge overdue write-backs or incidents.
- Duplicate n8n deliveries become no-ops instead of duplicate reminder rows.
- The replay guard is best-effort (15-minute TTL and opportunistic pruning), not a
  durable distributed nonce service. The production note calls this out.
- Provider-level duplicate sends remain possible if Slack/Resend accepts a message and
  the response is lost before the write-back; a provider idempotency token or outbox
  would close that gap.
