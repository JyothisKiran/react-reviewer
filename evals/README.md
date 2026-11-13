# Evals

30 cases that score the real review pipeline (`lib/review`), run with [promptfoo](https://promptfoo.dev). Results are recorded in [RESULTS.md](RESULTS.md).

- `cases/01.txt`–`30.txt`: 20 cases with a planted issue and 10 clean cases. They are `.txt` so the Next.js build ignores them. Line 1 of each file is line 1 of the code, because the scoring uses line numbers. Don't add a blank line at the top.
- `scoring-sheet-gem-original-2026-11-11.csv`: what each case expects, and the manual baseline for the original Gem.
- `provider.ts`: the promptfoo provider. It calls `reviewFiles` from `lib/review`, so the evals test what ships. It outputs the review JSON and puts the dropped findings and run details (`model`, `modelVersion`, `promptVersion`, `latencyMs`, `calls`, `validationRetries`) in the metadata.
- `assert.js`: scores each case. The test list and expectations are in `../promptfooconfig.yaml`.
- `summarize.js`: turns results files into the numbers for RESULTS.md.
- `results/`: raw promptfoo output, one file per run.

The `evals/` folder is excluded in `tsconfig.json`, `eslint.config.mjs` and `vitest.config.mts`.

## Running

From the project root:

```
PROMPTFOO_DISABLE_TELEMETRY=1 npx promptfoo@latest eval -o evals/results/<prompt-version>-<date>.json
node evals/summarize.js evals/results/<prompt-version>-<date>.json
```

- The provider reads `GEMINI_API_KEY` from `.env.local` itself.
- Cases run one at a time with a 2-second gap (`evaluateOptions` in `promptfooconfig.yaml`).
- Each case is one review: usually one Gemini call, at most 6 with retries.
- **Free-tier limits:** the free tier allows a small number of requests per model per day (20 for `gemini-3.5-flash` when this was written), which is fewer than the 30 cases. Either use a key with billing enabled, or split the run across days. Once the daily quota runs out, the remaining cases fail fast with `quota-exhausted` and use no quota. The next day, rerun only the errored ones and combine the files:

  ```
  npx promptfoo@latest eval -o evals/results/v1-prompt-part1.json
  # next day:
  npx promptfoo@latest eval --filter-errors-only evals/results/v1-prompt-part1.json -o evals/results/v1-prompt-part2.json
  node evals/summarize.js evals/results/v1-prompt-part1.json evals/results/v1-prompt-part2.json
  ```

  `summarize.js` lists any case that is still errored, so you can see the run is incomplete.

## Scoring

- Issue cases: **Caught** if a finding in an expected category starts inside the expected lines, at or above the minimum severity. Otherwise **Missed**. A missed case with a finding in the expected lines but the wrong severity or category is reported as **Partial**, with the reason.
- Clean cases: **Clean**, or **Noisy** if the review raises any finding at Medium or higher.
- **Case 09** (the linter already flagged `any`) gets the linter finding in `<linter_findings>`. Until v3 it is reported but left out of the false-positive rate, which is noisy ÷ 9 (÷ 10 from v3).

## Manual baseline (gem-original)

The original Gem was scored by hand, one case at a time, through **Paste a snippet instead** in the v1 app. The sheet holds those results.
