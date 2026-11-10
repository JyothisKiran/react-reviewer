"use client";

import { useState } from "react";
import Markdown from "react-markdown";

export type ReviewStatus = "idle" | "reviewing" | "done" | "error";

type Props = { review: string; status: ReviewStatus; error: string; fileCount: number };

export function ReviewOutput({ review, status, error, fileCount }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyReview() {
    await navigator.clipboard.writeText(review);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section
      aria-labelledby="review-heading"
      className="flex min-h-[60vh] flex-col rounded-lg border border-l-4 border-rule border-l-pencil bg-sheet"
    >
      <div className="flex items-center justify-between border-b border-rule px-6 py-4">
        <h2 id="review-heading" className="text-lg font-bold">Review</h2>
        {status === "done" && (
          <button type="button" onClick={copyReview}
            className="rounded-md border border-rule px-3 py-1.5 text-sm font-bold hover:border-pencil focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pencil">
            {copied ? "Copied" : "Copy review"}
          </button>
        )}
      </div>

      <div className="flex-1 px-6 py-5">
        <p className="sr-only" aria-live="polite">
          {status === "reviewing" ? "Review started" : status === "done" ? "Review finished" : ""}
        </p>

        {status === "idle" && (
          <p className="max-w-prose text-ink/70">
            Add the files you want reviewed, then start the review. A component reviewed together with its
            hooks and tests gets the most useful feedback.
          </p>
        )}
        {status === "reviewing" && !review && (
          <p className="text-ink/70 motion-safe:animate-pulse">
            Reading {fileCount} {fileCount === 1 ? "file" : "files"}…
          </p>
        )}
        {status === "error" && <p role="alert" className="text-red-700">{error}</p>}
        {review && (
          <div className="prose prose-slate max-w-prose">
            <Markdown>{review}</Markdown>
          </div>
        )}
      </div>
    </section>
  );
}