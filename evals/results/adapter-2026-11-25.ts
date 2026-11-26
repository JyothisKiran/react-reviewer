import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

type Vars = {
  path: string;
  casefile: string;
  linter?: { file: string; line: number; rule: string; message: string }[];
};

export default class VersionedReviewerProvider {
  id() {
    return `react-reviewer-${process.env.REVIEW_PROMPT_VERSION ?? "unset"}`;
  }

  async callApi(_prompt: string, context: { vars: Vars }) {
    const root = resolve(process.env.REVIEWER_ROOT ?? process.cwd());
    const version = process.env.REVIEW_PROMPT_VERSION;
    if (version !== "v1" && version !== "v2") {
      return { error: "REVIEW_PROMPT_VERSION must be v1 or v2." };
    }

    if (!process.env.GEMINI_API_KEY && existsSync(join(root, ".env.local"))) {
      process.loadEnvFile(join(root, ".env.local"));
    }

    const load = (file: string) => import(pathToFileURL(resolve(root, file)).href);
    const [{ annotate }, { buildPrompt }, { generateReview }, { postprocess }, { MODEL }] =
      await Promise.all([
        load("lib/review/annotate.ts"),
        load("lib/review/prompt.ts"),
        load("lib/review/gemini.ts"),
        load("lib/review/postprocess.ts"),
        load("lib/review/config.ts"),
      ]);

    const started = Date.now();
    const content = readFileSync(resolve(root, context.vars.casefile), "utf8");
    const { annotatedDiff, addedLines } = annotate([{ path: context.vars.path, content }]);
    const prompt = buildPrompt({
      annotatedDiff,
      linter: context.vars.linter ?? [],
    });
    prompt.system = readFileSync(join(root, "prompts", `review.${version}.md`), "utf8").trim();

    try {
      const generated = await generateReview(prompt);
      const { review, dropped } = postprocess(generated.review, addedLines);
      const latencyMs = Date.now() - started;
      return {
        output: JSON.stringify(review),
        latencyMs,
        metadata: {
          dropped,
          promptVersion: `review.${version}`,
          systemPromptFile: `prompts/review.${version}.md`,
          systemPromptSha256: createHash("sha256").update(prompt.system).digest("hex"),
          meta: {
            model: MODEL,
            modelVersion: generated.modelVersion,
            promptVersion: `review.${version}`,
            latencyMs,
            calls: generated.calls,
            validationRetries: generated.validationRetries,
          },
        },
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }
}
