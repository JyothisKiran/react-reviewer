# Eval results

Scoring rules are in [README.md](README.md). Recall counts the 20 cases with a planted issue. The false-positive rate counts the 9 clean cases and leaves out case 09 until v3.

| version | date | recall (Caught/20) | partial count | false-positive rate (Noisy/9) | notes |
|---|---|---|---|---|---|
| gem-original | 2026-11-11 | 20/20 (100%) | 0 | 5/9 (56%) | Manual run in the app, one case at a time. Noisy: 10, 11, 26, 27, 30. Case 09 skipped. Sheet: [scoring-sheet-gem-original-2026-11-11.csv](scoring-sheet-gem-original-2026-11-11.csv) |

## gem-original notes

- **Issue cases:** all 20 are marked Caught, each at or above the minimum severity. 17 were rated above the minimum and 3 (02, 03, 08) exactly at it.
- **Clean cases:** Noisy if any finding is Medium or higher (README rule). These were first entered as "Caught" and were corrected on 2026-11-11 using the sheet's Severity Given column (the highest severity found).
  - Noisy (highest finding Medium): 10, 11, 26, 27, 30
  - Clean (highest finding Low): 24, 25, 28, 29
- **Case 09** (linter already flagged `any`) got a High finding, so the sheet marks it Noisy. It's left out of the rate for now because the app doesn't pass linter results to the model yet.
- **Partial:** the sheet has no Partial results.
