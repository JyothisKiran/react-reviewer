# React Reviewer

AI code reviewer for React and TypeScript code. A portfolio project that started as a Gemini Gem. The full plan is in docs/ROADMAP.md.

## Stack
Next.js App Router, TypeScript (strict), Tailwind v4 with design tokens in app/globals.css (ink, paper, sheet, rule, pencil, highlight), fonts Atkinson Hyperlegible and JetBrains Mono, @google/genai for Gemini, Zod v4, react-markdown.

## Layout
- app/api/review/route.ts: review endpoint
- app/page.tsx, components/: UI
- lib/files.ts: file reading and limits (30 files, 200,000 characters)
- lib/review/: review pipeline (schema.ts, postprocess.ts, and more from v2)
- prompts/: gem.ts (original Gem, the baseline), review.v1.md and review.user.v1.md (structured prompt)
- evals/: 30 cases as .txt, assert.js, provider.ts, results; promptfooconfig.yaml at the root. evals/ is excluded from the Next.js build.
- docs/ROADMAP.md: versions, their specs and "done when" checks

## Rules
- Never send real client or company code to Gemini. Test with the eval cases or my own code.
- GEMINI_API_KEY lives only in .env.local. Never log it, commit it or send it to the browser.
- Inside lib/review use relative imports (no "@/"), so evals can import it outside Next.js.
- Never edit evals/cases/*.txt or eval expectations to make scores look better.
- Never overwrite a prompt version that has eval results; create the next version file instead.
- Accessibility: severity is never shown by colour alone, keyboard focus is always visible, every control has a label.
- Work on one roadmap version at a time. Show a plan first and wait for my approval.
- Before finishing: npm run build, npm run lint and npm test (once it exists) must pass.
- Never commit or push. When a change is done (and at the end of each version), give me a commit message and I'll commit it myself.

## Commands
npm run dev · npm run build · npm run lint · npm test (from v2) · npx promptfoo@latest eval
