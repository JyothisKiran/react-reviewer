import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { MODEL, REVIEW_TIMEOUT_MS } from "./config";
import type { BuiltPrompt } from "./prompt";
import { ReviewSchema, type Review } from "./schema";

/*
 * How the retries nest, for one review
 * ------------------------------------
 * deadline = start + REVIEW_TIMEOUT_MS (100 s; the route's maxDuration is 120 s)
 *
 * Validation rounds (at most 2)
 *   Call Gemini (below), then JSON.parse + ReviewSchema.safeParse.
 *   Invalid in round 1 -> round 2 resends the prompt with the validation errors appended.
 *   Invalid in round 2 -> ReviewError "invalid-output".
 *
 *   Transport attempts inside each round (at most 3)
 *     429 rate limit   -> wait the API's RetryInfo delay, or back off 1 s, 2 s (+ jitter).
 *     429 quota used up (a per-day quota or a limit of 0) -> no retry: "quota-exhausted".
 *     5xx / network    -> back off 1 s, 2 s (+ jitter).
 *     other 4xx        -> no retry: "rejected".
 *
 * So one review makes at most 2 x 3 = 6 calls. The deadline bounds all of them:
 * - every call gets an abort signal for the time left;
 * - no call starts with less than MIN_CALL_MS left ("timeout");
 * - no wait starts if it would leave less than MIN_CALL_MS for the next call; the
 *   last error is returned instead (for a 429, with the API's retry delay).
 * The SDK's own retries stay off (no httpOptions.retryOptions), so these are the only ones.
 */
const VALIDATION_ROUNDS = 2;
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 1_000;
const MAX_JITTER_MS = 250;
const MIN_CALL_MS = 10_000;
const MAX_FEEDBACK_CHARS = 1_500;

export type ReviewErrorCode =
  | "missing-api-key"
  | "quota-exhausted"
  | "rate-limited"
  | "unavailable"
  | "rejected"
  | "invalid-output"
  | "timeout";

export class ReviewError extends Error {
  readonly code: ReviewErrorCode;
  /** HTTP status from Gemini, when there was one. */
  readonly status?: number;
  /** For "rate-limited": how long the API asked us to wait. */
  readonly retryAfterSeconds?: number;

  constructor(
    code: ReviewErrorCode,
    message: string,
    details: { status?: number; retryAfterSeconds?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: details.cause });
    this.name = "ReviewError";
    this.code = code;
    this.status = details.status;
    this.retryAfterSeconds = details.retryAfterSeconds;
  }
}

// ---------------------------------------------------------------------------
// Response schema

const GEMINI_SCHEMA_KEYWORDS = new Set([
  "$id", "$defs", "$ref", "$anchor", "type", "format", "title", "description", "enum",
  "items", "prefixItems", "minItems", "maxItems", "minimum", "maximum", "anyOf", "oneOf",
  "properties", "additionalProperties", "required", "propertyOrdering",
]);

/** Keywords Gemini's responseJsonSchema supports (from the @google/genai docs). */
export function isGeminiSchemaKeyword(key: string) {
  return GEMINI_SCHEMA_KEYWORDS.has(key);
}

/**
 * ReviewSchema as JSON Schema for responseJsonSchema: without "$schema" (not supported)
 * and with propertyOrdering on every object, so the model writes fields in schema order.
 */
export function reviewJsonSchema(): Record<string, unknown> {
  const schema: Record<string, unknown> = { ...z.toJSONSchema(ReviewSchema) };
  delete schema.$schema;
  return withPropertyOrdering(schema) as Record<string, unknown>;
}

function withPropertyOrdering(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(withPropertyOrdering);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    out[key] =
      key === "properties" && value && typeof value === "object"
        ? Object.fromEntries(Object.entries(value).map(([name, sub]) => [name, withPropertyOrdering(sub)]))
        : withPropertyOrdering(value);
  }
  if (out.properties && typeof out.properties === "object") out.propertyOrdering = Object.keys(out.properties);
  return out;
}

const RESPONSE_SCHEMA = reviewJsonSchema();

// ---------------------------------------------------------------------------
// Client

type GenerateParams = Parameters<GoogleGenAI["models"]["generateContent"]>[0];
export type GeminiResponse = { text?: string; modelVersion?: string; candidates?: { finishReason?: string }[] };
/** The part of GoogleGenAI this module uses, so tests can pass a fake. */
export type GeminiClient = { models: { generateContent(params: GenerateParams): Promise<GeminiResponse> } };

let defaultClient: GeminiClient | undefined;

export function getGeminiClient(): GeminiClient {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ReviewError("missing-api-key", "GEMINI_API_KEY is not set.");
  defaultClient ??= new GoogleGenAI({ apiKey });
  return defaultClient;
}

// ---------------------------------------------------------------------------
// Generate

export type GenerateOptions = {
  client?: GeminiClient;
  timeoutMs?: number;
  /** Injected in tests so retries don't really wait. */
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

export type GenerateResult = {
  review: Review;
  calls: number;
  validationRetries: number;
  /** The model that actually answered; Gemini can route a model name to a newer version. */
  modelVersion?: string;
};

type Context = Required<Omit<GenerateOptions, "timeoutMs">> & { deadline: number; system: string; calls: number };

export async function generateReview(
  prompt: BuiltPrompt,
  options: GenerateOptions = {},
  deadline?: number,
): Promise<GenerateResult> {
  const now = options.now ?? Date.now;
  const ctx: Context = {
    client: options.client ?? getGeminiClient(),
    now,
    sleep: options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    random: options.random ?? Math.random,
    deadline: deadline ?? now() + (options.timeoutMs ?? REVIEW_TIMEOUT_MS),
    system: prompt.system,
    calls: 0,
  };

  let user = prompt.user;
  let problem = "";
  for (let round = 1; round <= VALIDATION_ROUNDS; round++) {
    const response = await callWithRetry(ctx, user);
    const parsed = parseReview(response);
    if (parsed.ok) {
      return { review: parsed.review, calls: ctx.calls, validationRetries: round - 1, modelVersion: response.modelVersion };
    }
    problem = parsed.problem;
    user = withValidationFeedback(prompt.user, problem);
  }
  throw new ReviewError(
    "invalid-output",
    `Gemini's response didn't match the review schema in ${VALIDATION_ROUNDS} tries. Last problem: ${problem}`,
  );
}

async function callWithRetry(ctx: Context, user: string): Promise<GeminiResponse> {
  for (let attempt = 1; ; attempt++) {
    const remaining = ctx.deadline - ctx.now();
    if (remaining < MIN_CALL_MS) {
      throw new ReviewError("timeout", `Less than ${MIN_CALL_MS / 1000} s of the review's time budget was left.`);
    }
    try {
      ctx.calls++;
      return await ctx.client.models.generateContent({
        model: MODEL,
        contents: user,
        config: {
          systemInstruction: ctx.system,
          responseMimeType: "application/json",
          responseJsonSchema: RESPONSE_SCHEMA,
          abortSignal: AbortSignal.timeout(remaining),
        },
      });
    } catch (error) {
      const failure = classify(error);
      if (!failure.retryable || attempt === MAX_ATTEMPTS) throw failure.error;
      const wait = failure.retryAfterMs ?? backoff(attempt, ctx.random);
      if (ctx.now() + wait + MIN_CALL_MS > ctx.deadline) throw failure.error;
      await ctx.sleep(wait);
    }
  }
}

function backoff(attempt: number, random: () => number) {
  return BASE_BACKOFF_MS * 2 ** (attempt - 1) + Math.round(random() * MAX_JITTER_MS);
}

// ---------------------------------------------------------------------------
// Validation

type Parsed = { ok: true; review: Review } | { ok: false; problem: string };

function parseReview(response: GeminiResponse): Parsed {
  const finish = response.candidates?.[0]?.finishReason;
  const because = finish && finish !== "STOP" ? ` (finish reason: ${finish})` : "";
  const text = response.text?.trim();
  if (!text) return { ok: false, problem: `The response was empty${because}.` };

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, problem: `The response wasn't valid JSON${because}.` };
  }
  const result = ReviewSchema.safeParse(json);
  return result.success
    ? { ok: true, review: result.data }
    : { ok: false, problem: z.prettifyError(result.error) };
}

function withValidationFeedback(user: string, problem: string) {
  const issues = problem.length > MAX_FEEDBACK_CHARS ? `${problem.slice(0, MAX_FEEDBACK_CHARS)}…` : problem;
  return `${user}\n\nYour previous response could not be used:\n${issues}\n\nRespond again with the complete review as JSON that matches the schema.`;
}

// ---------------------------------------------------------------------------
// Errors

type Failure = { error: unknown; retryable: boolean; retryAfterMs?: number };

function classify(error: unknown): Failure {
  if (error instanceof ReviewError) return { error, retryable: false };

  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return { error: new ReviewError("timeout", "Gemini didn't answer within the review's time budget.", { cause: error }), retryable: false };
  }

  const status = statusOf(error);
  const message = error instanceof Error ? error.message : String(error);

  if (status === 429) {
    const info = parseErrorBody(message);
    if (info.quotaExhausted) {
      return {
        error: new ReviewError("quota-exhausted", `Gemini quota used up: ${info.message}`, { status, cause: error }),
        retryable: false,
      };
    }
    const retryAfterSeconds = info.retryDelayMs === undefined ? undefined : Math.ceil(info.retryDelayMs / 1000);
    return {
      error: new ReviewError("rate-limited", `Gemini rate limit: ${info.message}`, { status, retryAfterSeconds, cause: error }),
      retryable: true,
      retryAfterMs: info.retryDelayMs,
    };
  }
  if (status !== undefined && status >= 500) {
    return { error: new ReviewError("unavailable", `Gemini returned ${status}: ${message}`, { status, cause: error }), retryable: true };
  }
  if (status !== undefined) {
    return { error: new ReviewError("rejected", `Gemini returned ${status}: ${message}`, { status, cause: error }), retryable: false };
  }
  // fetch() throws a TypeError when the network fails.
  if (error instanceof TypeError) {
    return { error: new ReviewError("unavailable", `Couldn't reach Gemini: ${message}`, { cause: error }), retryable: true };
  }
  return { error, retryable: false };
}

function statusOf(error: unknown): number | undefined {
  if (!(error instanceof Error) || !("status" in error)) return undefined;
  return typeof error.status === "number" ? error.status : undefined;
}

type ErrorBody = {
  error?: {
    message?: string;
    details?: {
      "@type"?: string;
      retryDelay?: string;
      violations?: { quotaId?: string; quotaValue?: string }[];
    }[];
  };
};

/**
 * Reads Gemini's error body. The SDK puts the response JSON in ApiError.message:
 * RetryInfo.retryDelay ("37s") says when to retry; QuotaFailure violations say which
 * quota ran out. A per-day quota or a limit of 0 won't recover by waiting.
 */
export function parseErrorBody(message: string) {
  let body: ErrorBody = {};
  try {
    body = JSON.parse(message) as ErrorBody;
  } catch {
    // Not JSON: fall back to the raw message below.
  }
  const details = body.error?.details ?? [];
  const text = body.error?.message ?? message;

  const delay = details.find((d) => d["@type"]?.endsWith("RetryInfo"))?.retryDelay ?? text.match(/retry in ([\d.]+)s/i)?.[1];
  const seconds = delay === undefined ? NaN : parseFloat(delay);
  const violations = details.filter((d) => d["@type"]?.endsWith("QuotaFailure")).flatMap((d) => d.violations ?? []);
  const quotaExhausted =
    violations.some((v) => /per\s*day/i.test(v.quotaId ?? "") || v.quotaValue === "0") || /\blimit: 0\b/.test(text);

  return {
    message: text,
    retryDelayMs: Number.isFinite(seconds) ? Math.round(seconds * 1000) : undefined,
    quotaExhausted,
  };
}
