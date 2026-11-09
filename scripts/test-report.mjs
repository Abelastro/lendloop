import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

mkdirSync("reports", { recursive: true });

const vitest = spawnSync("npx", ["vitest", "run", "--coverage"], {
  stdio: "inherit",
  env: { ...process.env, TEST_REPORT: "1" },
});

const summarize = spawnSync(process.execPath, ["scripts/summarize-tests.mjs"], {
  stdio: "inherit",
});

process.exit(vitest.status ?? summarize.status ?? 1);
