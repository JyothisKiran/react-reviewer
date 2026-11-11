# Roadmap

## Done
- v0: paste one snippet, get a markdown review using the original Gem instructions.
- v1: multi-file review (files, folder or pasted snippet), streaming markdown output, polished UI.

## v2: Structured review
Goal: replace the markdown review with validated JSON findings shown as cards.
- lib/review/annotate.ts: turn uploaded files into the annotated format the user template expects. Uploaded files count as new files, so every line is an added line ("+ N | code"). Also return addedLines (path -> line number -> text) for postprocess.
- lib/review/prompt.ts: load prompts/review.v1.md as the system instruction and fill prompts/review.user.v1.md. Project context comes from lib/review/config.ts defaults (React 19, React Compiler off, TypeScript strict, Redux Toolkit + RTK Query, Vite, Vitest + React Testing Library). An optional "Describe the change" field fills the PR title/description. linter_findings is empty for now.
- Prompt files must be available in the deployed Vercel function. If they are read with fs, include them in the route's output file tracing, and confirm with a production build.
- lib/review/gemini.ts: call Gemini with structured output generated from ReviewSchema (Zod v4 to JSON Schema). Check the installed @google/genai types and docs for the exact config fields; don't guess. Validate the response with ReviewSchema.safeParse and retry once if it's invalid. Retry 429 and 5xx errors with exponential backoff (at most 3 attempts).
- lib/review/index.ts: export reviewFiles(files, options) returning { review, dropped, meta: { model, promptVersion, latencyMs } }, using postprocess.ts.
- Route: returns JSON (no streaming) and keeps the current input validation.
- UI:
  - Optional "Describe the change" field.
  - Results header: rating, readiness, summary, and a count per severity.
  - Finding cards grouped by file and sorted by severity. Each card shows a severity label (text plus colour), category, kind, title, why, fix, and suggested code if present. "Show code" reveals the flagged lines with 3 lines of context, taken from the uploaded file, with the flagged line highlighted.
  - Severity filter. Strengths and assumptions sections.
  - A clear "No issues found" state for zero findings.
  - The loading state names the files being reviewed. Errors say what to do next.
  - "Copy as markdown" button.
- Tests: set up Vitest + React Testing Library (jsdom) and add an npm test script.
  - Unit tests for annotate, prompt building, and postprocess (confidence filter, grounding, cap, sorting).
  - Component tests for a finding card and for the zero-findings state.
  - Gemini is mocked; no network calls in tests.
- Evals:
  - evals/provider.ts calls reviewFiles.
  - Make promptfoo load GEMINI_API_KEY from .env.local, and run with low concurrency for free-tier limits.
  - Run all 30 cases. Save raw output to evals/results/, and add a "v1-prompt" row to evals/RESULTS.md: recall (caught/20), false-positive rate (noisy/9, excluding case 09), and dropped counts.
Done when: build, lint and tests pass; the app shows cards for a real review; RESULTS.md compares gem-original against v1-prompt.

## v2.x: Prompt tuning
- Read the failed eval cases and their outputs. Group failures into missed, under-rated and noisy.
- Create prompts/review.v2.md with targeted changes (keep v1), run the evals, and add a row to RESULTS.md. Repeat at most 3 times.
- Don't overfit: never quote or describe specific eval cases in the prompt.
- The app uses the best-scoring version.
Done when: RESULTS.md has a row per prompt version and the app uses the best one.

## v3: Linter layer
- Run ESLint in the review pipeline through the ESLint Node API with an in-memory config: typescript-eslint parser, plus the recommended rules from react-hooks and jsx-a11y.
- Pass the results into <linter_findings>. Show them in the UI as cards labelled "Linter".
- Case 09 now counts in scoring: the false-positive rate becomes noisy/10.
- Confirm it works in a production build on Vercel.
Done when: linter cards appear, case 09 passes, and RESULTS.md is updated.

## v4: Review a GitHub pull request by link
- Input for a public PR URL. Fetch changed files and patches through the GitHub REST API on the server, with an optional GITHUB_TOKEN for higher rate limits.
- Parse diff hunks into the annotated format with real new-file line numbers. Only added lines are reviewable. Skip lockfiles, generated files and binaries. Apply the existing limits.
- Each finding links to its line on GitHub.
- Tests for diff parsing: multiple hunks, renamed files, deleted files.
Done when: a public PR link produces a review with correct line numbers.

## v5: GitHub App
- Webhook route:
  - Verify X-Hub-Signature-256 with a constant-time comparison.
  - Handle pull_request opened and synchronize events.
  - Respond quickly and do the review after responding.
- Idempotency: skip the review if this app already posted a review for the same head commit SHA. Check the PR's existing reviews; no database needed.
- Post one PR review: the summary as the body, findings as inline comments on added lines.
- docs/GITHUB_APP.md: how I register the app (permissions, events, env vars GITHUB_APP_ID, GITHUB_PRIVATE_KEY, GITHUB_WEBHOOK_SECRET) and test it locally with smee.
- Tests for signature verification and idempotency.
Done when: opening a PR on a test repo with the app installed posts inline review comments.

## v6: Accounts, history and team rules
- GitHub sign-in (Auth.js) and hosted Postgres (Drizzle or Prisma).
- Save reviews and findings. History page.
- Thumbs up/down on each finding. Downvoted findings can be exported as candidate eval cases.
- Rule packs: per-project rules text and project context (React version, compiler, state libraries, test stack), editable in the UI, with owner and member roles. These feed <team_rules> and <project_context>.
- Authorization is checked on the server for every route.
Done when: a signed-in user sees their history, edits rules, and the rules change reviews.

## v7: Quality pass
- Playwright E2E tests for the main flows, with Gemini mocked.
- Lighthouse score of 90 or more on the main page, zero axe violations, a keyboard-only run-through, and a bundle size check.
- GitHub Actions: typecheck, lint, unit tests with a 70% coverage gate, and build. Run the promptfoo evals when prompts/ or lib/review/ change, using a GEMINI_API_KEY secret.
Done when: CI is green on main.

## v8: Ship
- README with:
  - the problem it solves and a demo GIF
  - an architecture diagram
  - the eval results table from gem-original to the latest version
  - trade-offs, privacy note and what's next
  - "started as a Gemini Gem"
- Install the GitHub App on this repo so the reviewer reviews its own PRs, and capture screenshots.
- Draft a write-up in docs/ titled "What I learned measuring an AI code reviewer".
Done when: the README is complete and the live link works.
