import { annotate } from "./annotate";
import { MODEL, PROMPT_VERSION } from "./config";
import { generateReview, type GenerateOptions } from "./gemini";
import { postprocess, type DroppedFinding } from "./postprocess";
import { buildPrompt, type LinterFinding } from "./prompt";
import type { Review } from "./schema";

export type ReviewInputFile = { path: string; content: string };

export type ReviewOptions = {
  /** "Describe the change" text from the UI. */
  change?: string;
  /** Findings the linter already reported, so the model doesn't repeat them. */
  linter?: LinterFinding[];
  /** Overrides for tests (fake client, clock). */
  gemini?: GenerateOptions;
};

export type ReviewMeta = {
  /** The model requested. */
  model: string;
  /** The model that answered, as Gemini reports it. */
  modelVersion?: string;
  promptVersion: string;
  latencyMs: number;
  /** Gemini calls made, including retries. */
  calls: number;
  /** 1 if the first response failed validation and was asked for again. */
  validationRetries: number;
};

export type ReviewResult = { review: Review; dropped: DroppedFinding[]; meta: ReviewMeta };

export async function reviewFiles(files: ReviewInputFile[], options: ReviewOptions = {}): Promise<ReviewResult> {
  const started = Date.now();
  const { annotatedDiff, addedLines } = annotate(files);
  const prompt = buildPrompt({ annotatedDiff, change: options.change, linter: options.linter });
  const { review: raw, calls, validationRetries, modelVersion } = await generateReview(prompt, options.gemini);
  const { review, dropped } = postprocess(raw, addedLines);

  return {
    review,
    dropped,
    meta: {
      model: MODEL,
      modelVersion,
      promptVersion: PROMPT_VERSION,
      latencyMs: Date.now() - started,
      calls,
      validationRetries,
    },
  };
}

export { ReviewError, type ReviewErrorCode } from "./gemini";
export type { DroppedFinding, DropReason } from "./postprocess";
export type { LinterFinding } from "./prompt";
export type { Finding, Review } from "./schema";
