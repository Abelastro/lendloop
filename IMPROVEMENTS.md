# LendLoop — Review & Improvement Plan

> Audit of `/workspace/githubProjects/lendloop` against the original project brief
> (public tool board, Clerk auth, Convex RBAC, two signed n8n workflows, admin
> roles, bonus automation-activity). Written so a coding agent can work through it
> top-to-bottom without re-deriving context.

---

## Implementation status

This file is the original pre-hardening audit, retained as a record. The delivered
code now addresses every P0 and P1 item, plus the P2 documentation, index,
HTTP-validation, and test-expansion work:

- P0: fail-closed email verification, sanitized stored errors/incidents,
  rate-limit index fixes, and idempotency-header passthrough with pre-send and
  rolling-24-hour dedupe.
- P1: accessible contrast, dark Clerk surfaces, root error/global-error/not-found
  boundaries, form labels/errors/helpers, mirror-server client validation, capped
  hero with mobile navigation, and design-token/type hygiene.
- P2: README production and observability guidance, a server-side enforcement map,
  Cloud workflow validation, a Compose healthcheck, CI formatting, a
  `loans.by_created_at` index, HTTP loan-ID validation, and additional Vitest
  coverage for form rules and workflow idempotency.

Post-audit hardening completed after this original review:

- Fixed the Clerk CSP host derivation so authenticated sign-in actually works in
  the browser (the previous policy only allowed `*.clerk.accounts.dev`, while the
  frontend API and bot-protection probes also use `*.accounts.dev` and
  `*.protect.clerk.com`).
- Removed the unused reminder idempotency argument, corrected the admin loan
  count label, stopped sending an absent idempotency header on the signed GET,
  and fixed the Slack receipt message ID.
- Added signed-request replay claims, a fixed-window webhook rate limiter,
  opt-in Resend per-recipient email, and provider-neutral OpenTelemetry.
- Added `convex-test` RBAC/lifecycle/HTTP tests, component tests, Playwright
  public browser flows, and committed JUnit/JSON/LCOV reports under `reports/`.
- Captured real screenshots with Clerk dev sessions and demo data; they are
  committed under `docs/screenshots/` and embedded in the README.
- Added ADRs, an AWS deployment mapping, an AI guardrails note, and an MIT
  license.

The original audit text below is retained as the pre-hardening record.

---

## Overall rating: 8 / 10 (A−)

Portfolio-grade. It ships every requested surface — the whole brief is present and
wired — but a sharp reviewer will catch a handful of security-hygiene and
accessibility gaps before they become embarrassments.

| Area                      | Score    | One-line verdict                                                                          |
| ------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| Feature completeness      | 9.5 / 10 | All views + admin + bonus activity/incidents wired end-to-end.                            |
| Backend / RBAC / security | 8 / 10   | Server-side RBAC + data-minimization are textbook; 3 hygiene holes remain.                |
| n8n integration           | 8 / 10   | Real two-way HMAC + error workflow + retries; idempotency is half-built.                  |
| UI / UX / design          | 8 / 10   | Polished, full loading/empty/error states, coherent dark palette; a11y + Clerk-dark bugs. |
| Docs (README)             | 8.5 / 10 | Thorough and accurate; missing screenshots.                                               |
| Testing                   | 7.5 / 10 | 17 tests, but only pure functions + workflow JSON — no component/Convex-logic tests.      |

### What is already done well (do not regress these)

- **Server-side RBAC on every mutation.** Owner-only edit/delete, lender-only
  approve/decline, borrower-only cancel, owner-or-borrower `markReturned`,
  `requireAdmin` on all admin surfaces. Enforced in Convex, not just the UI.
- **Strict data minimization.** The public board returns only `{ name, category }`.
  Outbound n8n payloads carry display names + loan facts only — never emails or
  addresses.
- **Solid cryptographic integration.** Two independent directional HMAC secrets,
  `timingSafeEqual` compare, 300-second freshness window on both directions.
- **Error hygiene.** `sanitizeText` redacts tokens/URLs before outbound storage;
  error workflow wired; retries with backoff on both sides.
- **Design language.** Consistent moss/paper palette, full loading skeletons,
  filter-aware empty states, confirm modals before destructive actions.
- **Type safety.** Strict TS with `noUncheckedIndexedAccess`; no `any` /
  `as never` in client code.

---

## P0 — Security & correctness (fix before any push)

### 1. `verifiedEmail` fails open on a missing claim

**File:** `convex/lib/auth.ts:41`

`if (identity.emailVerified === false)` only rejects an _explicitly_ `false`
claim. `UserIdentity.emailVerified` is **optional** (`emailVerified?: boolean`),
so a Clerk JWT template that omits `email_verified` yields `undefined`, the check
passes, and an unverified / unknown email is accepted — and can then match
`ADMIN_EMAILS`.

**Fix:** `if (identity.emailVerified !== true) throw new ConvexError(...)`.

### 2. Secret / URL leakage into stored errors & incidents

**Files:** `convex/automations.ts:235`, `convex/automations.ts:267`

`sanitizeText` (redacts URLs + Slack/Stripe tokens) is only applied to outbound
delivery failures. But `recordReminders` stores `reminder.error` and
`recordIncident` stores `args.message` with just whitespace-collapse + truncation.
n8n error strings routinely embed webhook URLs / tokens, so secrets persist in
`reminders.error` and `automationIncidents.message` and surface in the admin
incident queue.

**Fix:** route both through `sanitizeText()` before insert.

### 3. Rate-limit bypasses

**File:** `convex/lib/rateLimit.ts`

- **:27 — listing window** is counted over `by_owner_active` (which excludes
  removed tools). `create → remove → create` never accumulates toward
  `MAX_LISTINGS_PER_HOUR`. Count over `by_owner` filtered by `createdAt >= cutoff`.
- **:38 — request window** is read without `.order("desc")`, so it pulls the
  _oldest_ rows. For a borrower with >100 lifetime loans the filter sees nothing
  recent and `MAX_REQUESTS_PER_HOUR` silently never fires. Add `.order("desc")`
  before `.take(...)`.

### 4. n8n idempotency is half-built

**Files:** `scripts/build-workflows.mjs:190`, `convex/http.ts`,
`workflows/daily-overdue-reminders.json`

`x-lendloop-idempotency-key` is computed in the sign nodes but never transmitted
(`headerParams()` omits it) nor read by Convex. Worse, Slack reminders are sent
**before** the dedupe check — Convex only dedupes the stored rows — so a retry or
re-run can double-message a borrower.

**Fix (preferred):** (a) include the header in `headerParams()` and have
`readSignedBody` pass it into `recordReminders`/`recordIncident` as a first-class
dedupe key; (b) have "Prepare reminder" query Convex for an existing
`overdue:{loanId}:{date}` marker _before_ the Slack branch. Otherwise document
duplicate-send-on-retry as an accepted limitation.

---

## P1 — UX / accessibility / polish

### 5. `--faint` fails WCAG AA

**File:** `app/globals.css:31`

`#8b978b` on paper = **2.80:1** (needs 4.5:1) and is used for real 10–12px text
in ~10 spots (activity timestamps, admin labels, field placeholders, etc.).

**Fix:** darken to ≈`#6b776c` (≥4.5:1). The dark-mode value is already fine.

### 6. Clerk is un-themed in dark mode

**File:** `app/layout.tsx:37`

`appearance.variables` is set but there is no dark `baseTheme`. Sign-in/up cards
and the `UserButton` popover render light-on-dark and lose contrast.

**Fix:** pass a `prefers-color-scheme`-aware dark theme (e.g. `dark` baseTheme via
`appearance.baseTheme` keyed to the system/media query).

### 7. Missing root error / 404 boundaries

**Files:** only `app/app/error.tsx` exists.

A Convex outage on the landing page (`useQuery` in `public-board.tsx`) throws to
Next's default unstyled error page.

**Fix:** add `app/error.tsx`, `app/global-error.tsx`, and `app/not-found.tsx`.

### 8. Form accessibility

**Files:** `components/ui/field.tsx:48`, `tool-form-dialog.tsx`, `request-dialog.tsx`

- `FieldError` is a bare `<p>` — no `role="alert"` / `aria-live`, no
  `aria-describedby`, inputs lack `aria-invalid`.
- No per-field helper text (char limits, the 60-day rule) — limits are invisible
  until validation fails.
- Decorative icons are not `aria-hidden`.
- Input focus ring (`focus:ring-2 ring-moss/20`) is weaker than the global 2px
  `:focus-visible` outline.

**Fix:** `role="alert"` + `aria-describedby` on errors, `aria-invalid` on invalid
inputs, helper text per field, `aria-hidden` on decorative icons, ≥3:1 focus ring.

### 9. Client validation incomplete

**Files:** `tool-form-dialog.tsx`, `request-dialog.tsx`

- Tool form doesn't JS-check the 80/280 max (relies only on HTML `maxLength`).
- Request form has no **past-start-date** check (server rejects it) and hardcodes
  `60` instead of importing `MAX_LOAN_DAYS` from `convex/lib/constants.ts`.

**Fix:** mirror all server validation rules in JS.

### 10. Hero overflows short viewports

**Files:** `app/page.tsx:37`, `components/landing/site-header.tsx:21`

The `lg:aspect-[4/5]` hero image is ≈670px and pushes the CTA below the fold on
720–800px laptops. The landing header nav is `hidden md:flex` with no mobile menu.

**Fix:** cap hero image height (e.g. `lg:max-h-[64vh]`) or reduce the lg aspect;
add a small mobile menu / keep 2 key anchors visible.

### 11. Radius & type hygiene drift

**Files:** `admin-view.tsx:35`, `listings-view.tsx:149`, `app/page.tsx:78`,
`lib/utils.ts:61`, `components/app/workspace.tsx:62`, `components/app/status-badge.tsx`

- Scattered `rounded-[14px]` vs the 18/12/pill token scale — use
  `rounded-card` / `rounded-field`.
- Dead `initials()` in `lib/utils.ts`.
- Unnecessary `as Viewer` cast in `workspace.tsx`.
- Loose `string` status types in `status-badge.tsx` / `lib/utils.ts` should use
  the existing `LoanStatus` union.

---

## P2 — Docs / nice-to-have

### 12. Add screenshots

The only **weak** README deliverable. Add the landing board, `/app` loan card
with activity strip, and admin console.

### 13. README tweaks

- Document `npm test` / `npm run lint` / `npm run typecheck`.
- Name `N8N_ENCRYPTION_KEY` (currently only in the template).
- Extend repository layout with `proxy.ts` + `next.config.ts`.
- Mention `.github/workflows/ci.yml`.
- Drop the hard-coded "17 tests" count (it will go stale).
- Clarify the roles table columns ("user" vs "borrower" overlap ambiguously).

### 14. Test depth

17 tests cover only validation / crypto / workflow-JSON. Add Convex-logic tests
(RBAC denial paths, overlap, idempotency) and one or two component tests.

### 15. Minor backend

- `admin.ts:51` `order("desc").take(200)` on loans is an unindexed scan — add a
  `by_created_at` index.
- Admin role is sticky / never revocable (`users.ts:36`).
- `http.ts:88` unchecked `as Id<"loans">` cast can 500 instead of returning 400.

---

## Suggested order of work

1. **P0** (items 1–4): security + correctness — these are the ones a reviewer
   flags as "must fix before ship."
2. **P1** (items 5–11): a11y + dark-mode + polish — visible quality lift.
3. **P2** (items 12–15): docs, tests, minor backend.

After changes: run `npm run check`, `npm run format:check`, `npm run build`, and
re-run `npx convex codegen --system-udfs` if any `convex/` file changed.
