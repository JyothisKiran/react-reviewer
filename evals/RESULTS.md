# Eval results

Scoring rules are in [README.md](README.md). Recall counts the 20 cases with a planted issue. The false-positive rate counts the 9 clean cases and leaves out case 09 until v3.

| version | date | recall (Caught/20) | partial count | false-positive rate (Noisy/9) | dropped (low confidence / ungrounded / over cap) | notes |
|---|---|---|---|---|---|---|
| gem-original | 2026-11-11 | 20/20 (100%) | 0 | 5/9 (56%) | n/a (no postprocessing) | Manual run in the app, one case at a time. Noisy: 10, 11, 26, 27, 30. Case 09 skipped. Sheet: [scoring-sheet-gem-original-2026-11-11.csv](scoring-sheet-gem-original-2026-11-11.csv) |
| v1-prompt | 2026-11-24 | 16/20 (80%) | 0 | 0/9 (0%) | 0 / 3 / 0 (of 27 raw findings) | Automated run. Missed: 06, 07, 08, 19. No partial findings. Case 09 repeated the linter finding as Low, so it failed its linter-dedupe check but remains excluded from the false-positive rate. Raw: [v1-prompt-2026-11-24.json](results/v1-prompt-2026-11-24.json) |
| v2-prompt | 2026-11-24 | 18/20 (90%) | 0 | 1/9 (11%) | 0 / 0 / 0 (of 22 raw findings) | Automated run. Missed: 08, 19. Fixed: 06, 07, and 09. Regressed: 27 became noisy at Medium. Raw: [v2-prompt-2026-11-24.json](results/v2-prompt-2026-11-24.json) |

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
