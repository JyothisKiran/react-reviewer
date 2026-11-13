"use client";

import { useId, useState } from "react";
import type { Finding } from "@/lib/review";
import { splitLines } from "@/lib/review/annotate";
import { humanize, lineLabel } from "@/lib/review/format";
import { ModelText } from "./ModelText";
import { SEVERITY_BORDER, SeverityBadge } from "./SeverityBadge";

const CONTEXT_LINES = 3;

type Row = { number: number; text: string; flagged: boolean };

/** The flagged lines plus 3 lines either side, or null if the line isn't in the file. */
export function excerptFor(finding: Pick<Finding, "line" | "endLine">, content: string): Row[] | null {
  const lines = splitLines(content);
  const first = finding.line;
  const last = Math.max(first, finding.endLine ?? first);
  if (first < 1 || first > lines.length) return null;
  const start = Math.max(1, first - CONTEXT_LINES);
  const end = Math.min(lines.length, last + CONTEXT_LINES);
  return lines.slice(start - 1, end).map((text, i) => {
    const number = start + i;
    return { number, text, flagged: number >= first && number <= last };
  });
}

type Props = { finding: Finding; fileContent?: string };

export function FindingCard({ finding, fileContent }: Props) {
  const [showCode, setShowCode] = useState(false);
  const id = useId();
  const rows = fileContent === undefined ? null : excerptFor(finding, fileContent);

  return (
    <article
      aria-labelledby={`${id}-title`}
      className={`rounded-lg border border-l-4 border-rule bg-sheet p-4 ${SEVERITY_BORDER[finding.severity]}`}
    >
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink/70">
        <SeverityBadge severity={finding.severity} />
        <span>{humanize(finding.category)}</span>
        <span aria-hidden="true">·</span>
        <span>{humanize(finding.kind)}</span>
        <span aria-hidden="true">·</span>
        <span>{lineLabel(finding)}</span>
      </p>
      <h5 id={`${id}-title`} className="mt-2 text-base font-bold">{finding.title}</h5>

      <dl className="mt-2 flex flex-col gap-2">
        <div>
          <dt className="text-sm font-bold">Why</dt>
          <dd><ModelText>{finding.why}</ModelText></dd>
        </div>
        <div>
          <dt className="text-sm font-bold">Fix</dt>
          <dd><ModelText>{finding.fix}</ModelText></dd>
        </div>
        {finding.suggestedCode && (
          <div>
            <dt className="text-sm font-bold">Suggested code</dt>
            <dd>
              <pre className="mt-1 overflow-x-auto rounded-md border border-rule bg-paper p-3 font-mono text-sm">
                <code>{finding.suggestedCode}</code>
              </pre>
            </dd>
          </div>
        )}
      </dl>

      {rows && (
        <div className="mt-3">
          <button
            type="button"
            aria-expanded={showCode}
            aria-controls={`${id}-code`}
            onClick={() => setShowCode((shown) => !shown)}
            className="rounded-md border border-rule px-3 py-1.5 text-sm font-bold hover:border-pencil focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pencil"
          >
            {showCode ? "Hide code" : "Show code"}{" "}
            <span className="sr-only">for {finding.title}</span>
          </button>
          <div id={`${id}-code`} hidden={!showCode} className="mt-2">
            <CodeExcerpt file={finding.file} rows={rows} />
          </div>
        </div>
      )}
    </article>
  );
}

function CodeExcerpt({ file, rows }: { file: string; rows: Row[] }) {
  const first = rows[0].number;
  const last = rows[rows.length - 1].number;
  return (
    <figure>
      <figcaption className="text-sm text-ink/70">
        <span className="font-mono">{file}</span>, lines {first}–{last}. Flagged lines are marked ▶.
      </figcaption>
      <pre className="mt-1 overflow-x-auto rounded-md border border-rule bg-paper py-2 font-mono text-sm">
        <code className="block min-w-fit">
          {rows.map((row) => (
            <span key={row.number} data-flagged={row.flagged || undefined} className={`flex ${row.flagged ? "bg-highlight" : ""}`}>
              <span aria-hidden="true" className="w-6 shrink-0 text-center">{row.flagged ? "▶" : ""}</span>
              <span className="w-10 shrink-0 select-none pr-3 text-right text-ink/70">{row.number}</span>
              {row.flagged && <span className="sr-only">Flagged: </span>}
              <span className="whitespace-pre pr-4">{row.text || " "}</span>
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}
