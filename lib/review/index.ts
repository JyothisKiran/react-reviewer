import { annotate } from "./annotate";
import { MODEL, PROMPT_VERSION, REVIEW_TIMEOUT_MS } from "./config";
import { generateReview, type GenerateOptions } from "./gemini";
import { lintFiles, type LinterRun } from "./linter";
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
  lintLatencyMs: number;
};

export type ReviewResult = { review: Review; dropped: DroppedFinding[]; meta: ReviewMeta; linter: LinterRun };

export async function reviewFiles(files: ReviewInputFile[], options: ReviewOptions = {}): Promise<ReviewResult> {
  const now = options.gemini?.now ?? Date.now;
  const started = now();
  const deadline = started + (options.gemini?.timeoutMs ?? REVIEW_TIMEOUT_MS);
  const { annotatedDiff, addedLines } = annotate(files);
  const lintRun = await lintFiles(files, { deadline, now });
  const linterFindings = mergeLinterFindings(lintRun.findings, options.linter ?? []);
  const prompt = buildPrompt({ annotatedDiff, change: options.change, linter: linterFindings });
  const { review: raw, calls, validationRetries, modelVersion } = await generateReview(prompt, options.gemini, deadline);
  const { review, dropped } = postprocess(raw, addedLines, linterFindings);

  return {
    review,
    dropped,
    linter: { ...lintRun, findings: linterFindings },
    meta: {
      model: MODEL,
      modelVersion,
      promptVersion: PROMPT_VERSION,
      latencyMs: now() - started,
      calls,
      validationRetries,
      lintLatencyMs: lintRun.latencyMs,
    },
  };
}

function mergeLinterFindings(...groups: LinterFinding[][]) {
  const findings = new Map<string, LinterFinding>();
  for (const finding of groups.flat()) {
    findings.set(JSON.stringify([finding.file, finding.line, finding.rule, finding.message]), finding);
  }
  return [...findings.values()];
}

export { ReviewError, type ReviewErrorCode } from "./gemini";
export type { DroppedFinding, DropReason } from "./postprocess";
export type { LinterFinding } from "./prompt";
export type { LinterDiagnostic, LinterRun } from "./linter";
export type { Finding, Review } from "./schema";
