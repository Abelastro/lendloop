# ADR 0004: Provider-neutral OpenTelemetry instrumentation

- Status: Accepted
- Date: 2026-11-09

## Context

The role involves production logging and observability with tools such as Datadog and
Sentry. LendLoop already has an admin surface for failed notifications and unresolved
incidents, but that is pull-based: someone has to open the page.

A vendor SDK is easy to add, but it couples the project to one account and one agent
version. Next.js 16 and React 19 are new enough that a vendor SDK can lag the framework.

## Decision

Use OpenTelemetry via `@vercel/otel` in `instrumentation.ts`.

- Registration is opt-in: it only happens when `OTEL_EXPORTER_OTLP_ENDPOINT` is set.
- The service name comes from `OTEL_SERVICE_NAME`, defaulting to `lendloop-web`.
- The project does not commit a DSN, API key, or vendor-specific SDK.
- Any OTLP-compatible backend can receive the traces and logs, including a Datadog
  Agent/Collector, an OpenTelemetry Collector, or Sentry's OTLP endpoint.
- The admin console remains the in-product operational surface for failed events,
  incidents, and audit rows.

## Consequences

- The repo stays runnable without an observability account.
- Production operators must configure the exporter and alerting outside the repo.
- Alerting on failed deliveries, unresolved incidents, and scheduler lag is still a
  production task; the current admin console is visibility, not paging.
- If a vendor SDK becomes necessary, it can be added behind the same OTel pipeline
  rather than replacing the instrumentation.
