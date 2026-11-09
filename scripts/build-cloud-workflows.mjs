import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "workflows");
const CLOUD_OUT = join(OUT, "cloud");
mkdirSync(CLOUD_OUT, { recursive: true });

const replacements = [
  [
    "$env[['LENDLOOP', 'INBOUND', 'SECRET'].join('_')]",
    "$vars.LENDLOOP_INBOUND_SECRET",
  ],
  [
    "$env[['LENDLOOP', 'OUTBOUND', 'SECRET'].join('_')]",
    "$vars.LENDLOOP_OUTBOUND_SECRET",
  ],
  [
    "$env[['LENDLOOP', 'SLACK', 'WEBHOOK', 'URL'].join('_')]",
    "$vars.LENDLOOP_SLACK_WEBHOOK_URL",
  ],
  [
    "$env[['LENDLOOP', 'RESEND', 'API', 'KEY'].join('_')]",
    "$vars.LENDLOOP_RESEND_API_KEY",
  ],
  [
    "$env[['LENDLOOP', 'NOTIFICATION', 'FROM', 'EMAIL'].join('_')]",
    "$vars.LENDLOOP_NOTIFICATION_FROM_EMAIL",
  ],
  ["$env.LENDLOOP_CONVEX_SITE_URL", "$vars.LENDLOOP_CONVEX_SITE_URL"],
  ["$env.LENDLOOP_RESEND_API_KEY", "$vars.LENDLOOP_RESEND_API_KEY"],
];

function replaceEnv(value) {
  if (typeof value === "string") {
    return replacements.reduce(
      (result, [from, to]) => result.split(from).join(to),
      value,
    );
  }
  if (Array.isArray(value)) return value.map(replaceEnv);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, replaceEnv(child)]),
    );
  }
  return value;
}

const files = readdirSync(OUT)
  .filter((file) => file.endsWith(".json"))
  .sort();

for (const file of files) {
  const workflow = JSON.parse(readFileSync(join(OUT, file), "utf8"));
  const cloud = replaceEnv(workflow);
  writeFileSync(join(CLOUD_OUT, file), `${JSON.stringify(cloud, null, 2)}\n`);
  console.log(`wrote workflows/cloud/${file}`);
}
