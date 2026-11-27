# Eval results

Scoring rules are in [README.md](README.md). Recall counts the 20 cases with a planted issue. The false-positive rate counts all 10 clean cases, including case 09.

| version | date | recall (Caught/20) | partial count | false-positive rate | dropped (low confidence / ungrounded / over cap) | notes |
|---|---|---|---|---|---|---|
| gem-original | 2026-11-11 | 20/20 (100%) | 0 | 5/9 (56%) | n/a (no postprocessing) | Manual run in the app, one case at a time. Noisy: 10, 11, 26, 27, 30. Case 09 skipped. Sheet: [scoring-sheet-gem-original-2026-11-11.csv](scoring-sheet-gem-original-2026-11-11.csv) |
| v1-prompt | 2026-11-24 | 16/20 (80%) | 0 | 0/9 (0%) | 0 / 3 / 0 (of 27 raw findings) | Automated run. Missed: 06, 07, 08, 19. No partial findings. Case 09 repeated the linter finding as Low, so it failed its linter-dedupe check but remains excluded from the false-positive rate. Raw: [v1-prompt-2026-11-24.json](results/v1-prompt-2026-11-24.json) |
| v2-prompt | 2026-11-24 | 18/20 (90%) | 0 | 1/9 (11%) | 0 / 0 / 0 (of 22 raw findings) | Automated run. Missed: 08, 19. Improved: 06, 07, and 09. Regressed: 27 became noisy at Medium. Raw: [v2-prompt-2026-11-24.json](results/v2-prompt-2026-11-24.json) |
| v2-prompt (recomputed) | 2026-11-24 | 18/20 (90%) | 0 | 1/10 (10%) | 0 / 0 / 0 (of 22 raw findings) | Recomputed with case 09 in the 10-case clean denominator. Case 27 was noisy. Raw: [v2-prompt-2026-11-24.json](results/v2-prompt-2026-11-24.json) |
| v2-prompt + linter | 2026-11-27 | 16/20 (80%) first run; 50/60 (83.3%) repeat | 0 | 0/10 (0%); repeat 0/30 (0%) | 0 / 0 / 0 / 1 duplicate (of 21 raw findings) | Full run with repeat 3, 90 results, no cache hits or errors. Repeat failures: case 06 1 miss, cases 07/08/19 3 misses each, for 10 total issue misses. Case 09 passed all 3 runs and its model finding was deduped once. Raw: [v2-linter-repeat3-2026-11-27.json](results/v2-linter-repeat3-2026-11-27.json) |

The repeat run has 50 caught out of 60 issue-run slots: 10/60 misses. The misses are 06 (run 1), 07 (runs 1-3), 08 (runs 1-3), and 19 (runs 1-3). Case 06 is an issue case, not a clean-case failure.

## Known limitations

- **Case 08 (injection + float bug):** Across the six v2 outputs in the earlier repeat file plus the 2026-11-25 full repeat file, v2 produced no finding about the injected comment and detected the float-money issue in 2 of 6 runs: once at Medium and once at High. None of these float-money findings was dropped. Not addressed in v2.x.
- Known: `npm audit --omit=dev` reports 6 moderate advisories (minimatch, via @typescript-eslint/typescript-estree 8.72.1). The fix is in 8.74.0 (published 2026-11-23). Bump after 2026-12-07 once the 14-day check passes.
- Case 28: the saved `no-unused-vars` report for `LeaveRequestForm` is not reproduced by the linter engine against the current case source, and `LeaveRequestForm` is used at lines 12 and 24; treat it as an inconsistent run artifact, not a defect in the component implementation.

### Lint-only case 07 and 28 comparison

The adapter passed these exact inputs to ESLint:

- Case 07: path `src/features/achievements/AchievementsPage.tsx`, 600 bytes from [07.txt](cases/07.txt).
- Case 28: path `src/features/leave/LeaveRequestForm.test.tsx`, 1224 bytes from [28.txt](cases/28.txt).

The app pipeline uses the same `lintText(content, { filePath: path })` call, with the TypeScript parser for TS/TSX, `ecmaVersion: latest`, `sourceType: module`, JSX enabled, the TypeScript recommended preset, jsx-a11y recommended rules, and only `rules-of-hooks` and `exhaustive-deps` from React Hooks.

The direct lint-only recheck reproduced neither saved finding. The saved case 28 `no-unused-vars` and case 07 `no-unused-vars` results could not be reproduced from the exact files/config; no cause for their appearance was found in the saved metadata or direct comparison.

## Pooled repeat results

Each result combines the original full-suite run with three repeat runs: 4 samples per prompt/case. These samples are small, so individual pass counts are unstable. Case 27's v1 baseline pass was a lucky result. Case 09 is included here as a linter-deduplication check and in the recomputed v2 false-positive denominator.

| case | v1 pass | v1 run order | v2 pass | v2 run order | pooled interpretation |
|---|---|---|---|---|---|
| 06 | 2/4 | Fail, Fail, Pass, Pass | 1/4 | Pass, Fail, Fail, Fail | V1 and v2 remain inconsistent at this sample size. |
| 07 | 1/4 | Fail, Pass, Fail, Fail | 3/4 | Pass, Pass, Fail, Pass | V2 led 3/4 to 1/4, but the samples are limited. |
| 08 | 0/4 | Fail, Fail, Fail, Fail | 0/4 | Fail, Fail, Fail, Fail | Neither prompt caught the planted issue across all four samples. |
| 09 | 0/4 | Fail, Fail, Fail, Fail | 2/4 | Pass, Fail, Pass, Fail | V2 passed 2/4; both prompts showed variability. |
| 19 | 2/4 | Fail, Pass, Fail, Pass | 3/4 | Fail, Pass, Pass, Pass | V2 led 3/4 to 2/4, but the sample is limited. |
| 27 | 2/4 | Pass, Fail, Pass, Fail | 1/4 | Fail, Fail, Pass, Fail | Case 27's v1 baseline pass was not stable; v2 was noisy in one of four runs. |

Raw repeat data: [repeats-2026-11-24.json](results/repeats-2026-11-24.json).

## Full repeated evals (2026-11-25 and 2026-11-26)

Runs used Promptfoo `--repeat 3 --no-cache` with the evaluation-only adapter below; every result records its explicit prompt version. The adapter uses the app's model, time budget, project context, and review stages. The 2026-11-26 run keeps `review.v2` unchanged and changes only the pipeline's whitespace-insensitive evidence comparison. All three runs completed 90 cases with zero errors and caching disabled. The new result file also preserves each pre-postprocessing `rawReview`. Smoke-run system prompt SHA-256: v1 `fc169f16cc168f773c944dc3a1360d49a28e61dcef154a2330a02117e4b1b844`; v2 `6947b36eaec9540227ef72a39acdc19359dd50e96189ccb1878aea25ce7453aa`.

| prompt / pipeline | recall (caught/60) | false-positive rate (noisy/27, excluding case 09) | dropped (low-confidence / ungrounded / over cap, of 90) | unstable cases (passes/3) |
|---|---:|---:|---:|---|
| v1 | 50/60 (83.3%) | 2/27 (7.4%) | 0 / 4 / 0 | 07 (1/3), 19 (2/3), 23 (2/3), 27 (1/3) |
| v2 | 55/60 (91.7%) | 1/27 (3.7%) | 0 / 2 / 0 | 06 (2/3), 07 (2/3), 08 (1/3), 09 (2/3), 13 (2/3), 27 (2/3) |
| v2 + whitespace-insensitive grounding (pipeline change; `review.v2`) | 54/60 (90%) | 0/27 (0%) | 0 / 1 / 0 | 06 (2/3), 07 (2/3), 09 (2/3), 19 (2/3) |
| v2-prompt (recomputed; `review.v2`) | 55/60 (91.7%) | 2/30 (6.7%) | 0 / 2 / 0 | 06 (2/3), 07 (2/3), 08 (1/3), 09 (2/3), 13 (2/3), 27 (2/3) |
| v2 prompt + linter (`review.v2`) | 50/60 (83.3%) | 0/30 (0%) | 0 / 0 / 0, 1 duplicate | 06 (2/3) |

Per-case assertion passes:

| case | v1 passes/3 | v2 passes/3 | v2 + grounding passes/3 | v2 + linter passes/3 |
|---|---:|---:|---:|---:|
| 01 | 3/3 | 3/3 | 3/3 | 3/3 |
| 02 | 3/3 | 3/3 | 3/3 | 3/3 |
| 03 | 3/3 | 3/3 | 3/3 | 3/3 |
| 04 | 3/3 | 3/3 | 3/3 | 3/3 |
| 05 | 3/3 | 3/3 | 3/3 | 3/3 |
| 06 | 0/3 | 2/3 | 2/3 | 2/3 |
| 07 | 1/3 | 2/3 | 2/3 | 0/3 |
| 08 | 0/3 | 1/3 | 0/3 | 0/3 |
| 09 | 0/3 | 2/3 | 2/3 | 3/3 |
| 10 | 3/3 | 3/3 | 3/3 | 3/3 |
| 11 | 3/3 | 3/3 | 3/3 | 3/3 |
| 12 | 3/3 | 3/3 | 3/3 | 3/3 |
| 13 | 3/3 | 2/3 | 3/3 | 3/3 |
| 14 | 3/3 | 3/3 | 3/3 | 3/3 |
| 15 | 3/3 | 3/3 | 3/3 | 3/3 |
| 16 | 3/3 | 3/3 | 3/3 | 3/3 |
| 17 | 3/3 | 3/3 | 3/3 | 3/3 |
| 18 | 3/3 | 3/3 | 3/3 | 3/3 |
| 19 | 2/3 | 3/3 | 2/3 | 0/3 |
| 20 | 3/3 | 3/3 | 3/3 | 3/3 |
| 21 | 3/3 | 3/3 | 3/3 | 3/3 |
| 22 | 3/3 | 3/3 | 3/3 | 3/3 |
| 23 | 2/3 | 3/3 | 3/3 | 3/3 |
| 24 | 3/3 | 3/3 | 3/3 | 3/3 |
| 25 | 3/3 | 3/3 | 3/3 | 3/3 |
| 26 | 3/3 | 3/3 | 3/3 | 3/3 |
| 27 | 1/3 | 2/3 | 3/3 | 3/3 |
| 28 | 3/3 | 3/3 | 3/3 | 3/3 |
| 29 | 3/3 | 3/3 | 3/3 | 3/3 |
| 30 | 3/3 | 3/3 | 3/3 | 3/3 |

### Linter findings by case

These are totals across the 90 repeat results. A run had no linter finding unless the count is 1 or 3.

| case | linter findings (3 runs) | case | linter findings (3 runs) |
|---:|---:|---:|---:|
| 01 | 0 | 16 | 0 |
| 02 | 0 | 17 | 0 |
| 03 | 0 | 18 | 0 |
| 04 | 0 | 19 | 0 |
| 05 | 0 | 20 | 3 |
| 06 | 0 | 21 | 0 |
| 07 | 3 | 22 | 0 |
| 08 | 0 | 23 | 3 |
| 09 | 3 | 24 | 0 |
| 10 | 0 | 25 | 0 |
| 11 | 0 | 26 | 0 |
| 12 | 0 | 27 | 0 |
| 13 | 0 | 28 | 3 |
| 14 | 0 | 29 | 0 |
| 15 | 0 | 30 | 0 |

Every finding was one of:

- Case 07: `src/features/achievements/AchievementsPage.tsx:5`, `@typescript-eslint/no-unused-vars`, "'AchievementList' is defined but never used."
- Case 09: `src/utils/parseError.ts:1`, `@typescript-eslint/no-explicit-any`, "Unexpected any. Specify a different type."
- Case 20: `src/features/leave/LeaveRequestForm.test.tsx:4`, `@typescript-eslint/no-unused-vars`, "'LeaveRequestForm' is defined but never used."
- Case 23: `src/features/auth/LoginPage.tsx:2`, `@typescript-eslint/no-unused-vars`, "'LoginForm' is defined but never used."
- Case 28: `src/features/leave/LeaveRequestForm.test.tsx:4`, `@typescript-eslint/no-unused-vars`, "'LeaveRequestForm' is defined but never used."

### Linter on/off A/B for cases 07 and 19

The dated [adapter-linter-switch-2026-11-27.ts](results/adapter-linter-switch-2026-11-27.ts) used `--repeat 5 --no-cache`; both conditions had 0 cache hits and 0 errors.

| case | linter off passes/5 | linter on passes/5 |
|---|---:|---:|
| 07 | 3/5 | 0/5 |
| 19 | 2/5 | 2/5 |

Case 19 had no linter findings in all runs and acted as the noise control. Case 07 had one `@typescript-eslint/no-unused-vars` finding on line 5 in all five on runs.

The exact case 07 lint payload is `src/features/achievements/AchievementsPage.tsx` plus the 600-byte content of [07.txt](cases/07.txt). A direct repeat of the same app linter config produced no finding; the saved run reports it consistently but the cause could not be found in the saved adapter/input/config comparison.

### Case 09 synthetic dedupe replay

Saved case 09 outputs were replayed locally through postprocessing with synthetic line-1 findings:

| synthetic title | result |
|---|---|
| Avoid any | Dropped: duplicate of linter finding |
| Use a stricter type than any | Dropped: duplicate of linter finding |
| Type safety: any in parameter | Dropped: duplicate of linter finding |
| Replace unknown with typed union | Kept |
| Parameter type bypasses narrowing | Kept |

### Full rule-to-finding dedupe mapping

Deduplication requires matching file, line, category, and title pattern.

| linter rule | finding category | title pattern |
|---|---|---|
| `@typescript-eslint/no-explicit-any` | `typescript` | `/\bany\b/i` |
| `react-hooks/rules-of-hooks` | `react` | `/(?:conditional\|conditionally).{0,30}\bhooks?\b\|\bhooks?\b.{0,30}(?:conditional\|loop)/i` |
| `react-hooks/exhaustive-deps` | `react` | `/\bdependency array\b\|(?:missing\|incorrect\|stale).{0,30}\b(?:dependencies\|dependency\|closure)\b/i` |
| `jsx-a11y/alt-text` | `accessibility` | `/\balt(?: text\| attribute)?\b\|alternative text/i` |
| `jsx-a11y/anchor-has-content` | `accessibility` | `/(?:empty\|missing\|unnamed\|accessible name).{0,20}(?:anchor\|link)\|(?:anchor\|link).{0,20}(?:empty\|missing\|unnamed\|accessible name)/i` |
| `jsx-a11y/click-events-have-key-events` | `accessibility` | `/\bkeyboard (?:event\|handler\|equivalent)\b\|\bkey event\b/i` |
| `jsx-a11y/interactive-supports-focus` | `accessibility` | `/\b(?:not focusable\|focusable\|keyboard focus\|tabindex)\b/i` |
| `jsx-a11y/label-has-associated-control` | `accessibility` | `/\blabel\b.{0,30}\b(?:associated\|control\|input)\b\|\bform control\b.{0,30}\blabel\b/i` |
| `jsx-a11y/no-autofocus` | `accessibility` | `/\bauto.?focus\b/i` |
| `jsx-a11y/no-static-element-interactions` | `accessibility` | `/\bnon.?interactive element\b\|\bstatic element interaction\b/i` |

Raw results: [full-v1-repeat3-2026-11-25.json](results/full-v1-repeat3-2026-11-25.json), [full-v2-repeat3-2026-11-25.json](results/full-v2-repeat3-2026-11-25.json), [v2-whitespace-grounding-repeat3-2026-11-26.json](results/v2-whitespace-grounding-repeat3-2026-11-26.json). Adapter copy: [adapter-2026-11-25.ts](results/adapter-2026-11-25.ts).

## Definitions for automated runs

- **Caught / Noisy:** decided by [assert.js](assert.js).
- **Partial:** a planted issue the reviewer flagged inside the expected lines, but that didn't count as caught because of its **severity** (below the minimum), its **category** (not one of the expected ones), or both. Each partial case is listed with its reason. Partial cases are a subset of the not-caught ones.
- **Dropped:** raw model findings that postprocessing removed: confidence below 0.6, evidence not found on the cited added lines, or beyond the cap of 10. The counts are out of all raw findings in the run. For each missed or partial case, [summarize.js](summarize.js) says whether a matching finding was dropped and why.

To add a row, run the evals (see [README.md](README.md)), then `node evals/summarize.js evals/results/<file>.json`.

## gem-original notes

- **Issue cases:** all 20 are marked Caught, each at or above the minimum severity. 17 were rated above the minimum and 3 (02, 03, 08) exactly at it.
- **Clean cases:** Noisy if any finding is Medium or higher (README rule). These were first entered as "Caught" and were corrected on 2026-11-11 using the sheet's Severity Given column (the highest severity found).
  - Noisy (highest finding Medium): 10, 11, 26, 27, 30
  - Clean (highest finding Low): 24, 25, 28, 29
- **Case 09** (linter already flagged `any`) got a High finding, so the sheet marks it Noisy. It's left out of the rate for now because the app doesn't pass linter results to the model yet.
- **Partial:** the sheet has no Partial results.
