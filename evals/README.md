# Evals (parked)

These files are drafts for the next phase and are **not wired into the app yet**. They become runnable once the app returns structured JSON findings (`lib/review/schema.ts`) instead of a markdown report.

- `cases/01.txt`–`30.txt`: 20 cases with a planted issue and 10 clean cases. They are `.txt` so the Next.js build ignores them. Line 1 of each file is line 1 of the code, because the scoring uses line numbers. Don't add a blank line at the top.
- `scoring-sheet.csv`: what each case expects, plus an empty `Result` column for the manual baseline.
- `assert.js`, `provider.ts`: the promptfoo scorer and custom provider. The test list is in `../promptfooconfig.yaml`.

The `evals/` folder is excluded in `tsconfig.json` and `eslint.config.mjs`.

## Manual baseline (now)

1. Open the app and expand **Paste a snippet instead**.
2. For each case, set **File name** to the case's path and paste the whole `.txt` file into **Code**. The sheet's `File` column gives the file name; the full path (e.g. `src/features/profile/ProfileHeader.tsx`) is the `path` var for that case in `promptfooconfig.yaml`.
3. Review **one case at a time**. Remove the previous snippet before adding the next one.
4. Fill in `Result`:
   - Issue cases: **Caught** if the review names the planted problem near the expected lines at or above the minimum severity. Otherwise **Missed**.
   - Clean cases: **Clean**, or **Noisy** if the review raises any finding at Medium or higher.
   - **Skip case 09 for now.** The app doesn't pass linter results to the model yet, so the model will reasonably mention `any`.
5. Work out recall (caught ÷ 20) and the false-positive rate (noisy ÷ 9, or ÷ 10 once case 09 counts). Record them with the date and the label of the prompt you tested.

## Automated runs (later)

Once `lib/review` exports `reviewFiles`, run from the project root:

```
npx promptfoo@latest eval
```

`provider.ts` calls the real pipeline for each case, and `assert.js` scores the JSON it returns.
