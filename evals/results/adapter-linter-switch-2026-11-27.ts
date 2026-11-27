import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

type Vars = { path: string; casefile: string; linter?: unknown[] };

export default class LinterSwitchReviewerProvider {
  id() {
    return `react-reviewer-v2-linter-${process.env.LINTER_SWITCH === "off" ? "off" : "on"}`;
  }

  async callApi(_prompt: string, context: { vars: Vars }) {
    const root = resolve(process.env.REVIEWER_ROOT ?? process.cwd());
    if (!process.env.GEMINI_API_KEY && existsSync(join(root, ".env.local"))) {
      process.loadEnvFile(join(root, ".env.local"));
    }

    const started = Date.now();
    const content = readFileSync(resolve(root, context.vars.casefile), "utf8");
    let rawReview: unknown;
    const [{ getGeminiClient, generateReview }, { annotate }, { buildPrompt }, { postprocess }] =
      await Promise.all([
        import("../../lib/review/gemini.ts"),
        import("../../lib/review/annotate.ts"),
        import("../../lib/review/prompt.ts"),
        import("../../lib/review/postprocess.ts"),
      ]);
    const realClient = getGeminiClient();
    const capturingClient = {
      models: {
        async generateContent(params: Parameters<typeof realClient.models.generateContent>[0]) {
          const response = await realClient.models.generateContent(params);
          if (response.text) {
            try {
              rawReview = JSON.parse(response.text);
            } catch {
              rawReview = undefined;
            }
          }
          return response;
        },
      },
    };

    try {
      if (process.env.LINTER_SWITCH === "off") {
        const { annotatedDiff, addedLines } = annotate([{ path: context.vars.path, content }]);
        const prompt = buildPrompt({ annotatedDiff, linter: [] });
        const generated = await generateReview(prompt, { client: capturingClient });
        const result = postprocess(generated.review, addedLines, []);
        return {
          output: JSON.stringify(result.review),
          latencyMs: Date.now() - started,
          metadata: {
            rawReview,
            linter: { findings: [], diagnostics: [], latencyMs: 0 },
            linterFindings: [],
            linterDiagnostics: [],
            dropped: result.dropped,
            meta: {
              model: "gemini-3.5-flash-lite",
              modelVersion: generated.modelVersion,
              promptVersion: "review.v2",
              calls: generated.calls,
              validationRetries: generated.validationRetries,
              lintLatencyMs: 0,
            },
          },
        };
      }

      const { reviewFiles } = await import("../../lib/review/index.ts");
      const result = await reviewFiles(
        [{ path: context.vars.path, content }],
        { linter: context.vars.linter ?? [], gemini: { client: capturingClient } },
      );
      return {
        output: JSON.stringify(result.review),
        latencyMs: result.meta.latencyMs,
        metadata: {
          rawReview,
          linter: result.linter,
          linterFindings: result.linter.findings,
          linterDiagnostics: result.linter.diagnostics,
          dropped: result.dropped,
          meta: result.meta,
        },
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }
}
