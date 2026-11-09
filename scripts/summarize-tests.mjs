import { readFileSync, writeFileSync } from "node:fs";

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

const results = readJson("reports/vitest.json");
const coverage = readJson("reports/coverage/coverage-summary.json");

if (!results) {
  console.error("reports/vitest.json is missing. Run `npm run test:report`.");
  process.exit(1);
}

function pct(part, total) {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

function duration(ms) {
  return `${(ms / 1000).toFixed(2)}s`;
}

function backendCoverage() {
  if (!coverage) return null;
  const selected = Object.entries(coverage).filter(
    ([file]) =>
      file !== "total" && (file.includes("/convex/") || file.includes("/lib/")),
  );
  const totals = {
    lines: [0, 0],
    statements: [0, 0],
    functions: [0, 0],
    branches: [0, 0],
  };
  for (const [, data] of selected) {
    for (const key of Object.keys(totals)) {
      totals[key][0] += data[key].covered;
      totals[key][1] += data[key].total;
    }
  }
  return Object.fromEntries(
    Object.entries(totals).map(([key, [covered, total]]) => [
      key,
      { covered, total, pct: pct(covered, total) },
    ]),
  );
}

const rows = results.testResults.map((file) => {
  const name = file.name.replace(`${process.cwd()}/`, "");
  const total = file.assertionResults.length;
  const passed = file.assertionResults.filter(
    (test) => test.status === "passed",
  ).length;
  const failed = file.assertionResults.filter(
    (test) => test.status === "failed",
  ).length;
  const skipped = file.assertionResults.filter(
    (test) => test.status === "pending" || test.status === "skipped",
  ).length;
  return {
    name,
    total,
    passed,
    failed,
    skipped,
    duration: file.endTime - file.startTime,
  };
});

const totalDuration = rows.reduce((sum, row) => sum + row.duration, 0);
const backend = backendCoverage();
const started = results.startTime
  ? new Date(results.startTime).toISOString()
  : "unknown";

const coverageLines = coverage
  ? [
      "| Scope | Lines | Statements | Functions | Branches |",
      "| --- | ---: | ---: | ---: | ---: |",
      `| All instrumented code | ${coverage.total.lines.pct}% | ${coverage.total.statements.pct}% | ${coverage.total.functions.pct}% | ${coverage.total.branches.pct}% |`,
      backend
        ? `| Convex + shared lib | ${backend.lines.pct}% | ${backend.statements.pct}% | ${backend.functions.pct}% | ${backend.branches.pct}% |`
        : null,
      "",
      "React routes and most view components are exercised by the Playwright suite rather than Vitest; V8 coverage only measures modules imported by unit tests.",
    ].filter(Boolean)
  : ["Coverage summary was not generated."];

const markdown = `# LendLoop test report

Generated: ${new Date().toISOString()}
Vitest started: ${started}

## Summary

| Metric | Value |
| --- | ---: |
| Test suites | ${results.numTotalTestSuites} |
| Tests | ${results.numTotalTests} |
| Passed | ${results.numPassedTests} |
| Failed | ${results.numFailedTests} |
| Skipped | ${results.numPendingTests} |
| Pass rate | ${pct(results.numPassedTests, results.numTotalTests)}% |
| Suite duration | ${duration(totalDuration)} |
| Result | ${results.success ? "PASS" : "FAIL"} |

## Suites

| Suite | Tests | Passed | Failed | Skipped | Duration |
| --- | ---: | ---: | ---: | ---: | ---: |
${rows
  .map(
    (row) =>
      `| \`${row.name}\` | ${row.total} | ${row.passed} | ${row.failed} | ${row.skipped} | ${duration(row.duration)} |`,
  )
  .join("\n")}

## Coverage

${coverageLines.join("\n")}

## Artifacts

- \`reports/junit.xml\` — JUnit XML for CI systems
- \`reports/vitest.json\` — machine-readable Vitest results
- \`reports/coverage/lcov.info\` — LCOV line coverage
- \`reports/coverage/coverage-summary.json\` — JSON coverage summary
`;

writeFileSync("reports/test-summary.md", markdown);
console.log("wrote reports/test-summary.md");
