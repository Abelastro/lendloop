# Architecture decision records

| ADR                                 | Decision                                                                                      |
| ----------------------------------- | --------------------------------------------------------------------------------------------- |
| [0001](./0001-convex-rbac.md)       | Convex functions are the authorization boundary; admins do not bypass ownership checks        |
| [0002](./0002-hmac-idempotency.md)  | Two directional HMAC secrets, replay claims, idempotent write-backs, and visible retries      |
| [0003](./0003-data-minimization.md) | Public projections, minimal automation payloads, and sanitized operational errors             |
| [0004](./0004-observability.md)     | Provider-neutral OpenTelemetry export stays opt-in and the admin console remains the fallback |

Related design note: [AI guardrails](../AI_GUARDRAILS.md).
