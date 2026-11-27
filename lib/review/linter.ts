import { ESLint, type Linter } from "eslint";
import typescriptParser from "@typescript-eslint/parser";
import typescriptPlugin from "@typescript-eslint/eslint-plugin";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import type { LinterFinding } from "./prompt";

type ConfigPlugin = NonNullable<NonNullable<Linter.Config["plugins"]>[string]>;
type LintInputFile = { path: string; content: string };
type LintOptions = { deadline?: number; now?: () => number };

export type LinterDiagnostic = {
  file: string;
  status: "could not lint";
  reason: "unsupported-file-type" | "parse-failure" | "review-deadline";
  message: string;
  line?: number;
  column?: number;
};

export type LinterRun = {
  findings: LinterFinding[];
  diagnostics: LinterDiagnostic[];
  latencyMs: number;
};

const CODE_FILES = ["**/*.{js,jsx,mjs,cjs,ts,tsx}"];
const TYPESCRIPT_FILES = ["**/*.{ts,tsx}"];
const SUPPORTED_EXTENSION = /\.(?:js|jsx|mjs|cjs|ts|tsx)$/i;

function isFlatConfig(value: unknown): value is Linter.Config {
  if (!value || typeof value !== "object") return false;
  if (!("plugins" in value)) return true;
  const plugins = value.plugins;
  return plugins === undefined || (typeof plugins === "object" && plugins !== null && !Array.isArray(plugins));
}

function getTypeScriptRecommended() {
  const configs: unknown = typescriptPlugin.configs["flat/recommended"];
  if (!Array.isArray(configs) || !configs.every(isFlatConfig)) {
    throw new TypeError("The TypeScript ESLint recommended config is not a flat config array.");
  }
  return configs;
}

function pluginForEslint(meta: ConfigPlugin["meta"], rules: object): ConfigPlugin {
  // ESLint 9 and the plugins expose slightly different rule-context typings.
  return { meta, rules: rules as ConfigPlugin["rules"] };
}

const typescriptRecommended = getTypeScriptRecommended();
const typescriptPluginForEslint = pluginForEslint(typescriptPlugin.meta, typescriptPlugin.rules);
const jsxA11yPluginForEslint = pluginForEslint(jsxA11y.meta, jsxA11y.rules);
const reactHooksPluginForEslint = pluginForEslint(reactHooks.meta, reactHooks.rules);
const hooksRecommendedRules = reactHooks.configs.recommended.rules;
const reactHooksRules = {
  "react-hooks/rules-of-hooks": hooksRecommendedRules["react-hooks/rules-of-hooks"],
  "react-hooks/exhaustive-deps": hooksRecommendedRules["react-hooks/exhaustive-deps"],
};

const config: Linter.Config[] = [
  {
    name: "react-reviewer/base",
    files: CODE_FILES,
    languageOptions: {
      parserOptions: {
        ecmaVersion: "latest" as const,
        sourceType: "module" as const,
        ecmaFeatures: { jsx: true },
      },
    },
    linterOptions: { noInlineConfig: true },
  },
  ...typescriptRecommended.map((preset) => ({
    ...preset,
    files: TYPESCRIPT_FILES,
    plugins: { "@typescript-eslint": typescriptPluginForEslint },
    ...(preset.name === "typescript-eslint/base"
      ? {
          languageOptions: {
            ...preset.languageOptions,
            parser: typescriptParser,
            parserOptions: {
              ecmaVersion: "latest" as const,
              sourceType: "module" as const,
              ecmaFeatures: { jsx: true },
            },
          },
        }
      : {}),
  })),
  {
    ...jsxA11y.flatConfigs.recommended,
    files: CODE_FILES,
    plugins: { "jsx-a11y": jsxA11yPluginForEslint },
  },
  {
    name: "react-reviewer/react-hooks",
    files: CODE_FILES,
    plugins: { "react-hooks": reactHooksPluginForEslint },
    rules: reactHooksRules,
  },
];

let engine: ESLint | undefined;

function getEngine() {
  engine ??= new ESLint({
    overrideConfigFile: true,
    overrideConfig: config,
  });
  return engine;
}

function couldNotLint(
  file: string,
  reason: LinterDiagnostic["reason"],
  message: string,
  line?: number,
  column?: number,
): LinterDiagnostic {
  return {
    file,
    status: "could not lint",
    reason,
    message: `Could not lint this file: ${message}`,
    ...(line === undefined ? {} : { line }),
    ...(column === undefined ? {} : { column }),
  };
}

export async function lintFiles(
  files: LintInputFile[],
  options: LintOptions = {},
): Promise<LinterRun> {
  const now = options.now ?? Date.now;
  const started = now();
  const findings: LinterFinding[] = [];
  const diagnostics: LinterDiagnostic[] = [];

  for (const file of files) {
    if (!SUPPORTED_EXTENSION.test(file.path)) {
      diagnostics.push(
        couldNotLint(file.path, "unsupported-file-type", "unsupported file type."),
      );
      continue;
    }

    if (options.deadline !== undefined && now() >= options.deadline) {
      diagnostics.push(
        couldNotLint(file.path, "review-deadline", "the review time budget has expired."),
      );
      continue;
    }

    const results = await getEngine().lintText(file.content, { filePath: file.path });
    const messages = results.flatMap((result) => result.messages);
    const unlintable = messages.find((message) => message.fatal || !message.ruleId);

    if (unlintable) {
      diagnostics.push(
        couldNotLint(
          file.path,
          "parse-failure",
          unlintable.message,
          unlintable.line,
          unlintable.column,
        ),
      );
      continue;
    }

    for (const message of messages) {
      if (!message.ruleId || message.line === undefined) continue;
      findings.push({
        file: file.path,
        line: message.line,
        rule: message.ruleId,
        message: message.message,
      });
    }
  }

  return { findings, diagnostics, latencyMs: Math.max(0, now() - started) };
}
