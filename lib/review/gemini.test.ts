import { ApiError } from "@google/genai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateReview, parseErrorBody, ReviewError, type GeminiClient, type GeminiResponse } from "./gemini";
import type { Review } from "./schema";

const prompt = { system: "SYSTEM", user: "USER" };

const validReview: Review = {
  summary: "Adds a total.",
  rating: "good",
  readiness: "ready",
  strengths: [],
  assumptions: [],
  findings: [],
};
const ok = (review: unknown = validReview): GeminiResponse => ({ text: JSON.stringify(review) });

type Step = GeminiResponse | Error;

function setup(steps: Step[], { timeoutMs = 100_000 } = {}) {
  const requests: { contents: unknown; config: Record<string, unknown> }[] = [];
  const waits: number[] = [];
  let time = 0;
  const client: GeminiClient = {
    models: {
      async generateContent(params) {
        requests.push({ contents: params.contents, config: params.config as Record<string, unknown> });
        const step = steps.shift();
        if (!step) throw new Error("Test made more calls than expected");
        if (step instanceof Error) throw step;
        return step;
      },
    },
  };
  const options = {
    client,
    timeoutMs,
    now: () => time,
    sleep: async (ms: number) => { waits.push(ms); time += ms; },
    random: () => 0,
  };
  return { options, requests, waits, advance: (ms: number) => { time += ms; } };
}

function apiError(status: number, body: object = { error: { code: status, message: "boom" } }) {
  return new ApiError({ status, message: JSON.stringify(body) });
}

const rateLimit = (retryDelay?: string, quotaId = "GenerateRequestsPerMinutePerProjectPerModel-FreeTier") =>
  apiError(429, {
    error: {
      code: 429,
      message: "You exceeded your current quota.",
      status: "RESOURCE_EXHAUSTED",
      details: [
        { "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId, quotaValue: "10" }] },
        ...(retryDelay ? [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay }] : []),
      ],
    },
  });

async function codeOf(promise: Promise<unknown>) {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(ReviewError);
  return (error as ReviewError).code;
}

describe("generateReview", () => {
  it("sends the system prompt and structured-output config", async () => {
    const { options, requests } = setup([ok()]);
    const result = await generateReview(prompt, options);
    expect(result).toEqual({ review: validReview, calls: 1, validationRetries: 0 });
    expect(requests[0].contents).toBe("USER");
    expect(requests[0].config).toMatchObject({ systemInstruction: "SYSTEM", responseMimeType: "application/json" });
    expect(requests[0].config.responseJsonSchema).toMatchObject({ type: "object", propertyOrdering: expect.any(Array) });
    expect(requests[0].config.abortSignal).toBeInstanceOf(AbortSignal);
  });

  describe("validation retry", () => {
    it("asks again once, with the validation error in the prompt", async () => {
      const badFinding = { ...validReview, findings: [{ file: "a.ts", line: 1, confidence: 1.5 }] };
      const { options, requests } = setup([ok(badFinding), ok()]);
      const result = await generateReview(prompt, options);
      expect(result.validationRetries).toBe(1);
      expect(requests).toHaveLength(2);
      const retry = requests[1].contents as string;
      expect(retry.startsWith("USER\n\nYour previous response could not be used:")).toBe(true);
      expect(retry).toContain("findings[0].confidence");
      expect(retry).toContain("findings[0].severity");
    });

    it("reports invalid JSON and the finish reason", async () => {
      const truncated = { text: '{"summary": "cut o', candidates: [{ finishReason: "MAX_TOKENS" }] };
      const { options, requests } = setup([truncated, ok()]);
      await generateReview(prompt, options);
      expect(requests[1].contents).toContain("wasn't valid JSON (finish reason: MAX_TOKENS)");
    });

    it("gives up after the second invalid response", async () => {
      const { options, requests } = setup([{ text: "" }, { text: "not json" }]);
      expect(await codeOf(generateReview(prompt, options))).toBe("invalid-output");
      expect(requests).toHaveLength(2);
    });
  });

  describe("transport retries", () => {
    it("backs off 1 s then 2 s on 5xx", async () => {
      const { options, waits } = setup([apiError(503), apiError(500), ok()]);
      const result = await generateReview(prompt, options);
      expect(result.calls).toBe(3);
      expect(waits).toEqual([1000, 2000]);
    });

    it("stops after 3 attempts", async () => {
      const { options, requests } = setup([apiError(503), apiError(503), apiError(503)]);
      expect(await codeOf(generateReview(prompt, options))).toBe("unavailable");
      expect(requests).toHaveLength(3);
    });

    it("retries network errors", async () => {
      const { options } = setup([new TypeError("fetch failed"), ok()]);
      expect((await generateReview(prompt, options)).calls).toBe(2);
    });

    it("waits the API's retry delay on 429", async () => {
      const { options, waits } = setup([rateLimit("7s"), ok()]);
      await generateReview(prompt, options);
      expect(waits).toEqual([7000]);
    });

    it("backs off on 429 when no retry delay is given", async () => {
      const { options, waits } = setup([rateLimit(), ok()]);
      await generateReview(prompt, options);
      expect(waits).toEqual([1000]);
    });

    it("doesn't retry when the daily quota is used up", async () => {
      const { options, requests, waits } = setup([rateLimit("30s", "GenerateRequestsPerDayPerProjectPerModel-FreeTier")]);
      expect(await codeOf(generateReview(prompt, options))).toBe("quota-exhausted");
      expect(requests).toHaveLength(1);
      expect(waits).toEqual([]);
    });

    it("doesn't retry other 4xx errors", async () => {
      const { options, requests } = setup([apiError(400)]);
      const error = await generateReview(prompt, options).catch((e: ReviewError) => e);
      expect(error).toMatchObject({ code: "rejected", status: 400 });
      expect(requests).toHaveLength(1);
    });

    it("doesn't retry a timed-out call", async () => {
      const timeout = new DOMException("The operation timed out.", "TimeoutError");
      const { options, requests } = setup([timeout]);
      expect(await codeOf(generateReview(prompt, options))).toBe("timeout");
      expect(requests).toHaveLength(1);
    });
  });

  describe("time budget", () => {
    it("returns the rate limit with its delay instead of waiting past the deadline", async () => {
      const { options, waits } = setup([rateLimit("95s")]);
      const error = await generateReview(prompt, options).catch((e: ReviewError) => e);
      expect(error).toMatchObject({ code: "rate-limited", retryAfterSeconds: 95 });
      expect(waits).toEqual([]);
    });

    it("doesn't start a validation retry without enough time left", async () => {
      const { options, requests, advance } = setup([]);
      options.client.models.generateContent = async (params) => {
        requests.push({ contents: params.contents, config: {} });
        advance(95_000); // a slow first call
        return { text: "{}" };
      };
      expect(await codeOf(generateReview(prompt, options))).toBe("timeout");
      expect(requests).toHaveLength(1);
    });

    it("nests transport retries inside the validation retry", async () => {
      const { options, requests, waits } = setup([{ text: "{}" }, apiError(503), ok()]);
      const result = await generateReview(prompt, options);
      expect(result).toMatchObject({ calls: 3, validationRetries: 1 });
      expect(waits).toEqual([1000]);
      expect(requests[2].contents).toContain("Your previous response could not be used");
    });
  });

  describe("API key", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("fails clearly when GEMINI_API_KEY is missing", async () => {
      vi.stubEnv("GEMINI_API_KEY", "");
      expect(await codeOf(generateReview(prompt))).toBe("missing-api-key");
    });
  });
});

describe("parseErrorBody", () => {
  // Shape of a real free-tier 429 (messages shortened).
  const dailyLimit = JSON.stringify({
    error: {
      code: 429,
      message: "You exceeded your current quota... limit: 20, model: gemini-3.6-flash... Please retry in 21h33m17.376577572s.",
      status: "RESOURCE_EXHAUSTED",
      details: [
        { "@type": "type.googleapis.com/google.rpc.Help", links: [] },
        {
          "@type": "type.googleapis.com/google.rpc.QuotaFailure",
          violations: [{
            quotaMetric: "generativelanguage.googleapis.com/generate_content_free_tier_requests",
            quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
            quotaValue: "20",
          }],
        },
        { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "77597s" },
      ],
    },
  });

  it("treats a real per-day free-tier 429 as quota exhausted", () => {
    expect(parseErrorBody(dailyLimit)).toMatchObject({ quotaExhausted: true, retryDelayMs: 77_597_000 });
  });

  it("falls back to the message text when the body isn't JSON", () => {
    expect(parseErrorBody("Quota exceeded. Please retry in 12.5s.")).toMatchObject({ retryDelayMs: 12_500, quotaExhausted: false });
    expect(parseErrorBody("Quota exceeded for metric x, limit: 0")).toMatchObject({ quotaExhausted: true });
  });
});
