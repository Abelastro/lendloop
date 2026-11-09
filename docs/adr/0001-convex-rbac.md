# ADR 0001: Enforce authorization in Convex, not the UI

- Status: Accepted
- Date: 2026-11-09

## Context

LendLoop has a public read-only board, authenticated member views, and admin-only
actions. The browser is untrusted: a user can call Convex functions directly with a
valid Clerk token, bypassing the React UI.

The take-home brief explicitly requires RBAC to be enforced in Convex rather than only
in the interface.

## Decision

Every protected Convex function resolves the caller from the Clerk identity and checks
ownership or role before reading or mutating data.

- `requireViewer` resolves the `users` row by Clerk subject and rejects signed-out calls.
- `requireAdmin` additionally requires `role === "admin"`.
- Ownership checks compare the stored `ownerId`, `borrowerId`, or `returnedBy` value
  with the resolved viewer. Admins do **not** inherit owner powers for approve, cancel,
  or return; their extra powers are limited to admin-console actions.
- Admin elevation requires a **verified** email claim matching `ADMIN_EMAILS`. The role
  is persisted on the user row, and removing an email from `ADMIN_EMAILS` does not
  demote an existing admin. This is a deliberate lockout-safety choice.
- The UI hides actions a user cannot perform, but that is a convenience layer only.

## Consequences

- A forged request from the browser cannot act on another member's listing or loan.
- The admin console can be tested directly at the Convex-function level.
- The additive admin policy needs an explicit demotion/offboarding procedure before
  production use.
- The public board is a dedicated query that returns only `name` and `category`, so
  making it public does not expose owner identity.
