# Eval results

Scoring rules are in [README.md](README.md). Recall counts the 20 cases with a planted issue. The false-positive rate counts the 9 clean cases and leaves out case 09 until v3.

| version | date | recall (Caught/20) | partial count | false-positive rate (Noisy/9) | dropped (low confidence / ungrounded / over cap) | notes |
|---|---|---|---|---|---|---|
| gem-original | 2026-11-11 | 20/20 (100%) | 0 | 5/9 (56%) | n/a (no postprocessing) | Manual run in the app, one case at a time. Noisy: 10, 11, 26, 27, 30. Case 09 skipped. Sheet: [scoring-sheet-gem-original-2026-11-11.csv](scoring-sheet-gem-original-2026-11-11.csv) |
| v1-prompt | 2026-11-24 | 16/20 (80%) | 0 | 0/9 (0%) | 0 / 3 / 0 (of 27 raw findings) | Automated run. Missed: 06, 07, 08, 19. No partial findings. Case 09 repeated the linter finding as Low, so it failed its linter-dedupe check but remains excluded from the false-positive rate. Raw: [v1-prompt-2026-11-24.json](results/v1-prompt-2026-11-24.json) |
| v2-prompt | 2026-11-24 | 18/20 (90%) | 0 | 1/9 (11%) | 0 / 0 / 0 (of 22 raw findings) | Automated run. Missed: 08, 19. Improved: 06, 07, and 09. Regressed: 27 became noisy at Medium. Raw: [v2-prompt-2026-11-24.json](results/v2-prompt-2026-11-24.json) |

## Known limitations

- **Case 08 (injection + float bug):** Across the six v2 outputs in the earlier repeat file plus the 2026-11-25 full repeat file, v2 produced no finding about the injected comment and detected the float-money issue in 2 of 6 runs: once at Medium and once at High. None of these float-money findings was dropped. Not addressed in v2.x.

## Pooled repeat results

Each result combines the original full-suite run with three repeat runs: 4 samples per prompt/case. These samples are small, so individual pass counts are unstable. Case 27's v1 baseline pass was a lucky result. Case 09 is excluded from the false-positive rate; it is included here only as a linter-deduplication check.

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

Per-case assertion passes (case 09 is shown but excluded from the false-positive denominator):

| case | v1 passes/3 | v2 passes/3 | v2 + grounding passes/3 |
|---|---:|---:|---:|
| 01 | 3/3 | 3/3 | 3/3 |
| 02 | 3/3 | 3/3 | 3/3 |
| 03 | 3/3 | 3/3 | 3/3 |
| 04 | 3/3 | 3/3 | 3/3 |
| 05 | 3/3 | 3/3 | 3/3 |
| 06 | 0/3 | 2/3 | 2/3 |
| 07 | 1/3 | 2/3 | 2/3 |
| 08 | 0/3 | 1/3 | 0/3 |
| 09 | 0/3 | 2/3 | 2/3 |
| 10 | 3/3 | 3/3 | 3/3 |
| 11 | 3/3 | 3/3 | 3/3 |
| 12 | 3/3 | 3/3 | 3/3 |
| 13 | 3/3 | 2/3 | 3/3 |
| 14 | 3/3 | 3/3 | 3/3 |
| 15 | 3/3 | 3/3 | 3/3 |
| 16 | 3/3 | 3/3 | 3/3 |
| 17 | 3/3 | 3/3 | 3/3 |
| 18 | 3/3 | 3/3 | 3/3 |
| 19 | 2/3 | 3/3 | 2/3 |
| 20 | 3/3 | 3/3 | 3/3 |
| 21 | 3/3 | 3/3 | 3/3 |
| 22 | 3/3 | 3/3 | 3/3 |
| 23 | 2/3 | 3/3 | 3/3 |
| 24 | 3/3 | 3/3 | 3/3 |
| 25 | 3/3 | 3/3 | 3/3 |
| 26 | 3/3 | 3/3 | 3/3 |
| 27 | 1/3 | 2/3 | 3/3 |
| 28 | 3/3 | 3/3 | 3/3 |
| 29 | 3/3 | 3/3 | 3/3 |
| 30 | 3/3 | 3/3 | 3/3 |

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
