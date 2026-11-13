import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_PROJECT_CONTEXT, PROMPT_FILES, type ProjectContext } from "./config";

export type LinterFinding = { file: string; line: number; rule: string; message: string };

export type PromptInput = {
  annotatedDiff: string;
  /** "Describe the change": the first line becomes the PR title, the rest the description. */
  change?: string;
  linter?: LinterFinding[];
  teamRules?: string;
  projectContext?: Partial<ProjectContext>;
};

export type BuiltPrompt = { system: string; user: string };

// Explicit values for empty sections, so the model never sees a blank tag.
export const NONE = "None";
export const NOT_PROVIDED = "Not provided";

// Read on every call: the files are small, and prompt edits apply without a restart.
// process.cwd() is the project root in dev, in evals and in the deployed function;
// next.config.ts adds prompts/*.md to the route's file trace so they ship with it.
function readPrompt(file: string) {
  return readFileSync(join(process.cwd(), "prompts", file), "utf8");
}

export function splitChange(change = "") {
  const text = change.trim();
  if (!text) return { title: "", description: "" };
  const [first, ...rest] = text.split(/\r?\n/);
  return { title: first.trim(), description: rest.join("\n").trim() };
}

/**
 * Replaces {{name}} placeholders in one pass. Values are inserted literally, so code
 * containing "$&" or "{{prTitle}}" is never rewritten. A placeholder with no value throws.
 */
export function fillTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    if (!Object.hasOwn(values, name)) throw new Error(`No value for {{${name}}} in the prompt template.`);
    return values[name];
  });
}

export function buildPrompt(input: PromptInput): BuiltPrompt {
  const context = { ...DEFAULT_PROJECT_CONTEXT, ...input.projectContext };
  const { title, description } = splitChange(input.change);
  const linter = input.linter ?? [];

  const user = fillTemplate(readPrompt(PROMPT_FILES.user), {
    prTitle: title || NOT_PROVIDED,
    prDescription: description || NOT_PROVIDED,
    reactVersion: context.reactVersion,
    compilerEnabled: context.compilerEnabled ? "enabled" : "disabled",
    tsStrict: context.tsStrict ? "yes" : "no",
    stateLibs: context.stateLibs,
    framework: context.framework,
    testStack: context.testStack,
    teamRules: input.teamRules?.trim() || NONE,
    linterFindingsJson: linter.length ? JSON.stringify(linter, null, 2) : NONE,
    annotatedDiff: input.annotatedDiff,
  });

  return { system: readPrompt(PROMPT_FILES.system).trim(), user: user.trim() };
}
