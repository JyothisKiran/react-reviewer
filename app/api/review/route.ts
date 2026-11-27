import { MAX_CHANGE_CHARS, MAX_FILES, MAX_TOTAL_CHARS, totalChars, type SourceFile } from "@/lib/files";
import { ReviewError, reviewFiles, type ReviewErrorCode } from "@/lib/review";

// Must stay above REVIEW_TIMEOUT_MS in lib/review/config.ts, which bounds every Gemini
// call, retry and wait. route.test.ts checks this.
export const maxDuration = 120;

function checkFiles(files: unknown): string | null {
  if (!Array.isArray(files) || files.length === 0) return "Add at least one file to review.";
  if (files.length > MAX_FILES) return `You can review up to ${MAX_FILES} files at a time.`;
  const readable = files.every((f) => typeof f?.path === "string" && typeof f?.content === "string");
  if (!readable) return "Some files couldn't be read. Remove them and try again.";
  if (totalChars(files) > MAX_TOTAL_CHARS) {
    return "These files are too large to review together. Remove a few and try again.";
  }
  return null;
}

function checkChange(change: unknown): string | null {
  if (change === undefined || change === null) return null;
  if (typeof change !== "string") return "The change description couldn't be read. Clear it and try again.";
  if (change.length > MAX_CHANGE_CHARS) {
    return `Shorten the change description to ${MAX_CHANGE_CHARS.toLocaleString("en")} characters or fewer.`;
  }
  return null;
}

const FAILURES: Record<ReviewErrorCode, { status: number; message: (e: ReviewError) => string }> = {
  "missing-api-key": {
    status: 500,
    message: () => "The server has no Gemini API key. Add GEMINI_API_KEY to .env.local, restart the server, then try again.",
  },
  "quota-exhausted": {
    status: 429,
    message: () => "This Gemini API key has used up its quota for now. Try again after the quota resets, or use a key with a higher limit.",
  },
  "rate-limited": {
    status: 429,
    message: (e) =>
      `Gemini is limiting requests right now. Wait ${e.retryAfterSeconds ? `about ${e.retryAfterSeconds} seconds` : "a minute"}, then try again.`,
  },
  unavailable: { status: 503, message: () => "Gemini isn't responding right now. Try again in a minute." },
  rejected: {
    status: 502,
    message: (e) =>
      e.status === 401 || e.status === 403
        ? "Gemini rejected the API key. Check GEMINI_API_KEY in .env.local, restart the server, then try again."
        : "Gemini rejected the request. Check the server terminal for details.",
  },
  "invalid-output": {
    status: 502,
    message: () => "Gemini sent back a review that couldn't be read, even after a retry. Try again, or review fewer files at once.",
  },
  timeout: { status: 504, message: () => "The review took too long. Try again, or review fewer files at once." },
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const files: unknown = body?.files;
  const change: unknown = body?.change;

  const problem = checkFiles(files) ?? checkChange(change);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  const sources = (files as SourceFile[]).map(({ path, content }) => ({ path, content }));
  try {
    const result = await reviewFiles(sources, { change: change as string | undefined });
    const { meta, dropped } = result;
    console.info(
      `[review] ${sources.length} file(s), ${result.review.findings.length} finding(s) kept, ${dropped.length} dropped ` +
        `(${dropped.map((d) => d.reason).join(", ") || "none"}), ${result.linter.findings.length} linter finding(s), ` +
        `${result.linter.diagnostics.length} lint diagnostic(s), ${meta.lintLatencyMs} ms lint, ` +
        `${meta.calls} call(s), ${meta.latencyMs} ms, ${meta.modelVersion ?? meta.model}`,
    );
    return Response.json(result);
  } catch (error) {
    if (error instanceof ReviewError) {
      // The message holds Gemini's error text, never the request or the key.
      console.error(`[review] ${error.code}: ${error.message}`);
      const failure = FAILURES[error.code];
      return Response.json({ error: failure.message(error) }, { status: failure.status });
    }
    console.error("[review] unexpected error:", error instanceof Error ? (error.stack ?? error.message) : error);
    return Response.json({ error: "Something went wrong on the server. Check the server terminal, then try again." }, { status: 500 });
  }
}
