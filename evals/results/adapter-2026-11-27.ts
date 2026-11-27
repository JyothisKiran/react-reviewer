import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

type LinterFinding = { file: string; line: number; rule: string; message: string };
type Vars = { path: string; casefile: string; linter?: LinterFinding[] };

export default class LinterReviewerProvider {
  id() {
    return "react-reviewer-v2-linter";
  }

  async callApi(_prompt: string, context: { vars: Vars }) {
    const root = resolve(process.env.REVIEWER_ROOT ?? process.cwd());

    if (!process.env.GEMINI_API_KEY && existsSync(join(root, ".env.local"))) {
      process.loadEnvFile(join(root, ".env.local"));
    }

    const [{ reviewFiles }, { getGeminiClient }] = await Promise.all([
      import("../../lib/review/index.ts"),
      import("../../lib/review/gemini.ts"),
    ]);
    const content = readFileSync(resolve(root, context.vars.casefile), "utf8");
    let rawReview: unknown;
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
      const result = await reviewFiles(
        [{ path: context.vars.path, content }],
        {
          linter: context.vars.linter ?? [],
          gemini: { client: capturingClient },
        },
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
