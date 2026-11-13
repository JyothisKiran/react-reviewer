"use client";

import { useState } from "react";
import type { SourceFile } from "@/lib/files";
import type { ReviewResult } from "@/lib/review";
import { reviewToMarkdown } from "@/lib/review/format";
import { ReviewResults } from "./ReviewResults";

export type ReviewStatus = "idle" | "reviewing" | "done" | "error";

type Props = {
  status: ReviewStatus;
  error: string;
  result: ReviewResult | null;
  /** The files being reviewed, or that were reviewed. */
  files: SourceFile[];
  /** Changes on every new review, so filters reset. */
  runId: number;
};

const COPY_LABEL = { idle: "Copy as markdown", copied: "Copied", failed: "Couldn't copy" } as const;

export function ReviewOutput({ status, error, result, files, runId }: Props) {
  const [copy, setCopy] = useState<keyof typeof COPY_LABEL>("idle");

  async function copyMarkdown() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(reviewToMarkdown(result.review));
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
    setTimeout(() => setCopy("idle"), 2000);
  }

  const findings = result?.review.findings.length ?? 0;
  const announcement =
    status === "reviewing"
      ? `Reviewing ${files.length} ${files.length === 1 ? "file" : "files"}`
      : status === "done"
        ? findings
          ? `Review finished with ${findings} ${findings === 1 ? "finding" : "findings"}`
          : "Review finished. No issues found."
        : "";

  return (
    <section
      aria-labelledby="review-heading"
      className="flex min-h-[60vh] flex-col rounded-lg border border-l-4 border-rule border-l-pencil bg-sheet"
    >
      <div className="flex items-center justify-between border-b border-rule px-6 py-4">
        <h2 id="review-heading" className="text-lg font-bold">Review</h2>
        {status === "done" && result && (
          <button
            type="button"
            onClick={copyMarkdown}
            className="rounded-md border border-rule px-3 py-1.5 text-sm font-bold hover:border-pencil focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pencil"
          >
            {COPY_LABEL[copy]}
          </button>
        )}
      </div>

      <div className="flex-1 px-6 py-5">
        <p className="sr-only" aria-live="polite">{announcement}</p>

        {status === "idle" && (
          <p className="max-w-prose text-ink/70">
            Add the files you want reviewed, then start the review. A component reviewed together with its
            hooks and tests gets the most useful feedback.
          </p>
        )}
        {status === "reviewing" && (
          <div className="text-ink/70">
            <p className="motion-safe:animate-pulse">
              Reviewing {files.length} {files.length === 1 ? "file" : "files"}. This can take up to a minute.
            </p>
            <ul className="mt-2 max-h-48 overflow-y-auto font-mono text-sm">
              {files.map((f) => <li key={f.path} className="truncate" title={f.path}>{f.path}</li>)}
            </ul>
          </div>
        )}
        {status === "error" && (
          <div role="alert" className="max-w-prose">
            <p className="font-bold text-red-700">The review didn&apos;t finish.</p>
            <p className="mt-1">{error}</p>
          </div>
        )}
        {status === "done" && result && <ReviewResults key={runId} result={result} files={files} />}
      </div>
    </section>
  );
}
