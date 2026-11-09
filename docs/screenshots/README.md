# Screenshots

Generated from the local Next.js app against a Convex development deployment and
Clerk development instance. The demo data comes from `convex/dev.ts`; no
production records, emails, or credentials are included.

Regenerate them with the dev server running:

```bash
node --env-file=.env --env-file=.env.local scripts/prepare-demo.mjs
node --env-file=.env --env-file=.env.local scripts/capture-screenshots.mjs
```

| File                    | View                                        |
| ----------------------- | ------------------------------------------- |
| `landing.png`           | Public landing page, desktop                |
| `landing-mobile.png`    | Public landing page, mobile                 |
| `public-board.png`      | Public name-and-category shelf              |
| `workspace-browse.png`  | Authenticated board                         |
| `request-dialog.png`    | Date-range request dialog                   |
| `my-listings.png`       | A trusted lender's listings                 |
| `my-requests.png`       | A borrower's requests and activity          |
| `incoming-requests.png` | Owner review queue                          |
| `admin-console.png`     | Admin metrics, incidents, loans, and audits |
