import { existsSync, readFileSync } from "node:fs";
import { ReviewError, reviewFiles, type LinterFinding } from "../lib/review";

// promptfoo only reads .env, so load the key from .env.local here. It is never logged.
if (!process.env.GEMINI_API_KEY && existsSync(".env.local")) process.loadEnvFile(".env.local");

type Vars = { path: string; casefile: string; linter?: LinterFinding[] };

export default class ReviewerProvider {
  id() {
    return "react-reviewer";
  }

  async callApi(_prompt: string, context: { vars: Vars }) {
    const { path, casefile, linter = [] } = context.vars;
    const content = readFileSync(casefile, "utf8");
    try {
      const { review, dropped, meta } = await reviewFiles([{ path, content }], { linter });
      // assert.js reads `findings` at the top level, so the output is the review itself.
      // The dropped findings (with reasons) and run details go in metadata for summarize.js.
      return { output: JSON.stringify(review), latencyMs: meta.latencyMs, metadata: { dropped, meta } };
    } catch (error) {
      return { error: error instanceof ReviewError ? `${error.code}: ${error.message}` : String(error) };
    }
  }
}
