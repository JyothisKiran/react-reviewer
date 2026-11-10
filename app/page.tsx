"use client";

import { useState } from "react";
import { FilePicker } from "@/components/FilePicker";
import { ReviewOutput, type ReviewStatus } from "@/components/ReviewOutput";
import { MAX_FILES, MAX_TOTAL_CHARS, mergeFiles, totalChars, type SourceFile } from "@/lib/files";

export default function Home() {
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [review, setReview] = useState("");
  const [status, setStatus] = useState<ReviewStatus>("idle");
  const [error, setError] = useState("");

  const reviewing = status === "reviewing";
  const withinLimits = files.length <= MAX_FILES && totalChars(files) <= MAX_TOTAL_CHARS;
  const canReview = files.length > 0 && withinLimits && !reviewing;

  async function handleReview() {
    setStatus("reviewing");
    setReview("");
    setError("");
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "The review couldn't start. Try again in a moment.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        setReview((prev) => prev + text);
      }
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The review couldn't start. Try again in a moment.");
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
          <button
            type="button"
            onClick={handleReview}
            disabled={!canReview}
            className="rounded-md bg-pencil px-4 py-3 font-bold text-white hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pencil disabled:cursor-not-allowed disabled:opacity-50"
          >
            {buttonLabel}
          </button>
        </div>

        <ReviewOutput review={review} status={status} error={error} fileCount={files.length} />
      </main>
    </div>
  );
}