# LendLoop test report

Generated: 2026-11-09T13:52:32.901Z
Vitest started: 2026-11-09T13:51:43.302Z

## Summary

| Metric | Value |
| --- | ---: |
| Test suites | 21 |
| Tests | 47 |
| Passed | 47 |
| Failed | 0 |
| Skipped | 0 |
| Pass rate | 100% |
| Suite duration | 1.30s |
| Result | PASS |

## Suites

| Suite | Tests | Passed | Failed | Skipped | Duration |
| --- | ---: | ---: | ---: | ---: | ---: |
| `tests/components.test.tsx` | 3 | 3 | 0 | 0 | 0.13s |
| `tests/convex.test.ts` | 15 | 15 | 0 | 0 | 1.05s |
| `tests/crypto.test.ts` | 5 | 5 | 0 | 0 | 0.03s |
| `tests/form-validation.test.ts` | 10 | 10 | 0 | 0 | 0.02s |
| `tests/validation.test.ts` | 6 | 6 | 0 | 0 | 0.02s |
| `tests/workflows.test.ts` | 8 | 8 | 0 | 0 | 0.05s |

## Coverage

| Scope | Lines | Statements | Functions | Branches |
| --- | ---: | ---: | ---: | ---: |
| All instrumented code | 30.71% | 30.71% | 71.53% | 67.15% |
| Convex + shared lib | 60.2% | 60.2% | 73.6% | 67.5% |
React routes and most view components are exercised by the Playwright suite rather than Vitest; V8 coverage only measures modules imported by unit tests.

## Artifacts

- `reports/junit.xml` — JUnit XML for CI systems
- `reports/vitest.json` — machine-readable Vitest results
- `reports/coverage/lcov.info` — LCOV line coverage
- `reports/coverage/coverage-summary.json` — JSON coverage summary
