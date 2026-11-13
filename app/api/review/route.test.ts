import { afterEach, describe, expect, it, vi } from "vitest";
import { REVIEW_TIMEOUT_MS } from "@/lib/review/config";
import { ReviewError, reviewFiles, type ReviewResult } from "@/lib/review";
import { maxDuration, POST } from "./route";

vi.mock("@/lib/review", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/review")>()),
  reviewFiles: vi.fn(),
}));

const mockedReview = vi.mocked(reviewFiles);

function post(body: unknown) {
  return POST(new Request("http://localhost/api/review", { method: "POST", body: JSON.stringify(body) }));
}

const file = { path: "src/a.ts", content: "const a = 1;" };

const result: ReviewResult = {
  review: { summary: "s", rating: "good", readiness: "ready", strengths: [], assumptions: [], findings: [] },
  dropped: [],
  meta: { model: "m", promptVersion: "review.v1", latencyMs: 1, calls: 1, validationRetries: 0 },
};

describe("POST /api/review", () => {
  afterEach(() => mockedReview.mockReset());
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});

  it("leaves time for the response after the review's own deadline", () => {
    expect(maxDuration * 1000).toBeGreaterThan(REVIEW_TIMEOUT_MS);
  });

  it("returns the review as JSON", async () => {
    mockedReview.mockResolvedValue(result);
    const res = await post({ files: [file], change: "Add a" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(result);
    expect(mockedReview).toHaveBeenCalledWith([file], { change: "Add a" });
  });

  it("passes only path and content to the pipeline", async () => {
    mockedReview.mockResolvedValue(result);
    await post({ files: [{ ...file, extra: "x" }] });
    expect(mockedReview).toHaveBeenCalledWith([file], { change: undefined });
  });

  it.each([
    [{}, "Add at least one file"],
    [{ files: [{ path: "a.ts" }] }, "couldn't be read"],
    [{ files: [file], change: 42 }, "change description couldn't be read"],
    [{ files: [file], change: "x".repeat(2_001) }, "2,000 characters"],
  ])("rejects bad input %#", async (body, message) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain(message);
    expect(mockedReview).not.toHaveBeenCalled();
  });

  it.each([
    [new ReviewError("quota-exhausted", "x", { status: 429 }), 429, "used up its quota"],
    [new ReviewError("rate-limited", "x", { status: 429, retryAfterSeconds: 30 }), 429, "about 30 seconds"],
    [new ReviewError("rejected", "x", { status: 403 }), 502, "rejected the API key"],
    [new ReviewError("missing-api-key", "x"), 500, "Add GEMINI_API_KEY"],
    [new ReviewError("timeout", "x"), 504, "took too long"],
    [new Error("bug"), 500, "Something went wrong"],
  ])("explains failures and what to do next %#", async (error, status, message) => {
    mockedReview.mockRejectedValue(error);
    const res = await post({ files: [file] });
    expect(res.status).toBe(status);
    expect((await res.json()).error).toContain(message);
  });
});
