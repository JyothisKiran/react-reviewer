export const MODEL = "gemini-3.5-flash-lite";

// Never overwrite a prompt version that has eval results: add review.v2.md etc. and point here.
export const PROMPT_VERSION = "review.v2";
export const PROMPT_FILES = { system: "review.v2.md", user: "review.user.v1.md" } as const;

/**
 * Time budget for one review, covering every Gemini call, retry and wait.
 * Keep it below `maxDuration` in app/api/review/route.ts (route.test.ts checks this).
 */
export const REVIEW_TIMEOUT_MS = 100_000;

export type ProjectContext = {
  reactVersion: string;
  compilerEnabled: boolean;
  tsStrict: boolean;
  stateLibs: string;
  framework: string;
  testStack: string;
};

// Used until rule packs (v6) let each project set its own.
export const DEFAULT_PROJECT_CONTEXT: ProjectContext = {
  reactVersion: "19",
  compilerEnabled: false,
  tsStrict: true,
  stateLibs: "Redux Toolkit + RTK Query",
  framework: "Vite",
  testStack: "Vitest + React Testing Library",
};
