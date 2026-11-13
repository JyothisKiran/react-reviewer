"use client";

import { useState } from "react";
import type { SourceFile } from "@/lib/files";
import type { ReviewResult } from "@/lib/review";
import { SEVERITIES, type Severity } from "@/lib/review/constants";
import { countBySeverity, groupByFile, humanize, SEVERITY_LABEL } from "@/lib/review/format";
import { FindingCard } from "./FindingCard";
import { ModelText } from "./ModelText";
import { SeverityBadge } from "./SeverityBadge";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pencil";

type Props = { result: ReviewResult; files: SourceFile[] };

export function ReviewResults({ result, files }: Props) {
  const { review, dropped } = result;
  const [hidden, setHidden] = useState<ReadonlySet<Severity>>(new Set());

  const counts = countBySeverity(review.findings);
  const present = SEVERITIES.filter((s) => counts[s] > 0);
  const visible = review.findings.filter((f) => !hidden.has(f.severity));
  const contents = new Map(files.map((f) => [f.path, f.content]));

  function toggle(severity: Severity) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(severity)) next.delete(severity);
      else next.add(severity);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="summary-heading">
        <h3 id="summary-heading" className="sr-only">Summary</h3>
        <dl className="flex flex-wrap gap-x-6 gap-y-1">
          <div className="flex gap-2">
            <dt className="text-ink/70">Rating</dt>
            <dd className="font-bold">{humanize(review.rating)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-ink/70">Readiness</dt>
            <dd className="font-bold">{humanize(review.readiness)}</dd>
          </div>
        </dl>
        <ModelText className="mt-2">{review.summary}</ModelText>
        <ul aria-label="Findings by severity" className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          {SEVERITIES.map((s) => (
            <li key={s} className={`flex items-center gap-1.5 text-sm ${counts[s] ? "" : "opacity-60"}`}>
              <SeverityBadge severity={s} />
              <span>{counts[s]}</span>
            </li>
          ))}
        </ul>
      </section>

      {review.findings.length === 0 ? (
        <section aria-labelledby="no-issues-heading" className="rounded-lg border border-rule bg-paper p-5">
          <h3 id="no-issues-heading" className="text-lg font-bold">No issues found</h3>
          <p className="mt-1 text-ink/70">The reviewer found nothing in these files that needs changing.</p>
        </section>
      ) : (
        <section aria-labelledby="findings-heading" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 id="findings-heading" className="text-lg font-bold">Findings</h3>
            <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <legend className="float-left mr-1 text-sm text-ink/70">Show</legend>
              {present.map((s) => (
                <label key={s} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={!hidden.has(s)}
                    onChange={() => toggle(s)}
                    className={`h-4 w-4 accent-pencil ${focusRing}`}
                  />
                  {SEVERITY_LABEL[s]} ({counts[s]})
                </label>
              ))}
            </fieldset>
          </div>

          {visible.length === 0 ? (
            <p className="text-ink/70">
              No findings match the selected severities.{" "}
              <button type="button" onClick={() => setHidden(new Set())} className={`font-bold text-pencil underline ${focusRing}`}>
                Show all
              </button>
            </p>
          ) : (
            groupByFile(visible).map((group) => (
              <section key={group.file} aria-label={group.file} className="flex flex-col gap-3">
                <h4 className="break-all font-mono text-sm font-bold">{group.file}</h4>
                <ul className="flex flex-col gap-3">
                  {group.findings.map((finding, i) => (
                    <li key={`${finding.line}-${i}`}>
                      <FindingCard finding={finding} fileContent={contents.get(finding.file)} />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </section>
      )}

      {dropped.length > 0 && (
        <p className="text-sm text-ink/70">
          {dropped.length} more {dropped.length === 1 ? "finding was" : "findings were"} left out: the reviewer wasn&apos;t
          confident enough, couldn&apos;t quote the exact code, or went past the limit of 10.
        </p>
      )}

      {review.strengths.length > 0 && <TextList id="strengths-heading" title="Strengths" items={review.strengths} />}
      {review.assumptions.length > 0 && <TextList id="assumptions-heading" title="Assumptions" items={review.assumptions} />}
    </div>
  );
}

function TextList({ id, title, items }: { id: string; title: string; items: string[] }) {
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="text-lg font-bold">{title}</h3>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
        {items.map((item, i) => (
          <li key={i}><ModelText>{item}</ModelText></li>
        ))}
      </ul>
    </section>
  );
}
