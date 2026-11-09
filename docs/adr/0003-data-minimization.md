# ADR 0003: Minimize data on the public board and in automation payloads

- Status: Accepted
- Date: 2026-11-09

## Context

The product is a neighborhood tool board. Even a simple board can leak more than it
needs to: owner names, emails, addresses, descriptions, and availability history are
not required to decide whether to sign in.

The role is healthcare-adjacent, so the project should show restraint even though
LendLoop is not a healthcare application and is not HIPAA/SOC 2/GDPR-certified.

## Decision

- `tools.listPublic` returns **only** `name` and `category`. It does not return tool
  IDs, owner IDs, owner names, emails, notes, or availability history.
- The public board hides tools that are currently on loan and caps the preview at 18.
- Authenticated workspace views expose the owner's display name and trusted mark,
  because that is the decision context. Emails are not rendered on member boards.
- The admin console shows member email for accountability. Only admins can open it.
- Automation event payloads carry the event ID, type, actor name, recipient name, tool
  name, and loan dates/status. They do not carry descriptions, addresses, or full user
  profiles.
- Incident and delivery errors are sanitized before storage. URLs and common token
  patterns are redacted so a failing webhook cannot leak its secret into the admin UI.
- n8n execution data retention should be minimized in production; the sample workflows
  are designed to remain runnable without storing message bodies beyond what n8n needs.

## Consequences

- The public page is safe to expose without authentication.
- Members cannot discover a tool owner until they sign in.
- Admin accountability requires email visibility; that is an explicit trade-off.
- The project does not claim regulatory compliance. A real deployment in a regulated
  context needs a BAA or equivalent, DPAs, retention/deletion workflows, access
  reviews, encryption/key-management policy, and breach notification.
