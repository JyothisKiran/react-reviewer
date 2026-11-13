"use client";

import { useState } from "react";
import { FilePicker } from "@/components/FilePicker";
import { ReviewOutput, type ReviewStatus } from "@/components/ReviewOutput";
import { MAX_CHANGE_CHARS, MAX_FILES, MAX_TOTAL_CHARS, mergeFiles, totalChars, type SourceFile } from "@/lib/files";
import type { ReviewResult } from "@/lib/review";

const field =
  "w-full rounded-md border border-rule bg-sheet px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-pencil";

export default function Home() {
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [change, setChange] = useState("");
  const [status, setStatus] = useState<ReviewStatus>("idle");
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [reviewed, setReviewed] = useState<SourceFile[]>([]);
  const [error, setError] = useState("");
  const [runId, setRunId] = useState(0);

  const reviewing = status === "reviewing";
  const withinLimits = files.length <= MAX_FILES && totalChars(files) <= MAX_TOTAL_CHARS;
  const canReview = files.length > 0 && withinLimits && !reviewing;

  async function handleReview() {
    // Keep the files as sent, so "Show code" matches what was reviewed even if the list changes.
    const snapshot = files;
    setReviewed(snapshot);
    setStatus("reviewing");
    setResult(null);
    setError("");
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: snapshot, change }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.review) {
        throw new Error(data?.error ?? "The server sent back something unexpected. Try again in a moment.");
      }
      setResult(data as ReviewResult);
      setRunId((id) => id + 1);
      setStatus("done");
    } catch (e) {
      const offline = e instanceof TypeError;
      setError(
        offline
          ? "Couldn't reach the server. Check that it's running and you're online, then try again."
          : e instanceof Error ? e.message : "The review couldn't finish. Try again in a moment.",
      );
      setStatus("error");
    }
  }

  const buttonLabel = reviewing
    ? "Reviewing…"
    : files.length === 0
      ? "Add files to start"
      : `Review ${files.length} ${files.length === 1 ? "file" : "files"}`;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-rule bg-sheet">
        <div className="mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-2 px-6 py-5">
          <h1 className="text-2xl font-bold">React Reviewer</h1>
          <p className="text-ink/70">Senior-level code review for React and TypeScript files.</p>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-6 py-8 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <FilePicker
            files={files}
            onAdd={(added) => setFiles((prev) => mergeFiles(prev, added))}
            onRemove={(path) => setFiles((prev) => prev.filter((f) => f.path !== path))}
            onClear={() => setFiles([])}
            disabled={reviewing}
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="change" className="font-bold">
              Describe the change <span className="font-normal text-ink/70">(optional)</span>
            </label>
            <p id="change-hint" className="text-sm text-ink/70">
              What the code is for or what changed. The first line is used as the title.
            </p>
            <textarea
              id="change"
              aria-describedby="change-hint"
              value={change}
              onChange={(e) => setChange(e.target.value)}
              maxLength={MAX_CHANGE_CHARS}
              rows={3}
              disabled={reviewing}
              className={field}
            />
          </div>

          <button
            type="button"
            onClick={handleReview}
            disabled={!canReview}
            className="rounded-md bg-pencil px-4 py-3 font-bold text-white hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pencil disabled:cursor-not-allowed disabled:opacity-50"
          >
            {buttonLabel}
          </button>
        </div>

        <ReviewOutput status={status} error={error} result={result} files={reviewed} runId={runId} />
      </main>
    </div>
  );
}
