# AI and LLM guardrails

This document is a design note. LendLoop does **not** call an LLM today. The role
mentions production LLM guardrails, so this is the transferable safety model the project
would use if an AI feature were added.

## Intended use

A narrow, useful feature is an admin-only incident summary:

```text
admin console -> Next.js route -> guarded server call -> model
```

The model summarizes already-stored automation incidents and failed events. It does not
decide loans, approve members, or execute tools.

## Non-goals

- No diagnosis, therapy advice, or health advice.
- No processing of PHI or special-category data.
- No autonomous approval, denial, or trust decisions.
- No model-driven access to Convex mutations.
- No free-form upload of database rows or user profiles.

## Input controls

1. **Allow-list the fields** sent to the model: incident workflow, node, sanitized
   message, timestamps, and status. Never send emails, names, addresses, notes, or
   Clerk identifiers.
2. **Redact before the model**: URLs, bearer tokens, Slack/Stripe-style secrets,
   email addresses, and phone numbers. The existing `sanitizeText` helper is the first
   layer; a dedicated redactor would run before any model call.
3. **Bound size**: cap each incident and the total prompt, and reject unexpected types.
4. **Treat stored text as untrusted**: incident messages can contain attacker-controlled
   content. Delimit them as data, not instructions.

## Output controls

- Return structured JSON with a schema and reject anything outside it.
- Do not execute model output. It is displayed as text for a human admin.
- Do not let the model call tools, browse, or read additional rows.
- Show a clear "AI-generated summary" label and keep the underlying incident visible.
- If the model output contains unexpected URLs, secrets, or instructions, drop it and
  show the raw incident instead.

## Prompt-injection posture

- The system prompt says incident text is untrusted and must not be followed.
- Incident text is wrapped in explicit data delimiters.
- The model has no tool access and no write path, so a successful injection is limited
  to a misleading summary that a human reviews.
- Retrieval, if added later, must filter by tenant and admin role, not by model choice.

## Privacy and compliance

- LendLoop is not HIPAA, SOC 2, or GDPR-certified.
- A healthcare-adjacent deployment needs a BAA or equivalent, DPAs, retention and
  deletion rules, access reviews, encryption/key-management policy, and breach
  notification before any PHI is processed.
- The recommended default is to keep PHI out of prompts entirely.
- Use a provider with a no-training/zero-retention configuration for production.

## Evaluation and operations

- Maintain a small golden set of incident summaries and score factual coverage,
  redaction, refusal behavior, and prompt-injection resistance.
- Log model, prompt version, latency, token counts, and a content hash; do not log full
  prompts containing user data.
- Alert on schema failures, refusal spikes, latency, and cost.
- Keep a human-in-the-loop review before any summary is used in an external report.
- Pin model versions and have a rollback path.
