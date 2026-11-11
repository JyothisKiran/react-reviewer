import { readFileSync } from "node:fs";
import { reviewFiles } from "../lib/review"; // your M1 pipeline

export default class ReviewerProvider {
  id() { return "react-reviewer"; }
  async callApi(_prompt: string, context: { vars: Record<string, any> }) {
    const { path, casefile, linter } = context.vars;
    const content = readFileSync(casefile, "utf8");
    const review = await reviewFiles([{ path, content, isNew: true }], { linter });
    return { output: JSON.stringify(review) };
  }
}
