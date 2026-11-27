import { useId } from "react";
import type { LinterDiagnostic, LinterFinding } from "@/lib/review";

type Props = { findings: LinterFinding[]; diagnostics: LinterDiagnostic[] };
type DisplaySeverity = "Error" | "Warning";

const warningRules = new Set(["react-hooks/exhaustive-deps"]);
const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pencil";

function severityFor(rule: string): DisplaySeverity {
  return warningRules.has(rule) ? "Warning" : "Error";
}

function diagnosticLabel(reason: LinterDiagnostic["reason"]) {
  switch (reason) {
    case "parse-failure":
      return "Parse failure";
    case "unsupported-file-type":
      return "Unsupported file type";
    case "review-deadline":
      return "Review time limit";
  }
}

export function LinterResults({ findings, diagnostics }: Props) {
  if (findings.length === 0 && diagnostics.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {findings.length > 0 && (
        <section aria-labelledby="linter-findings-heading" className="flex flex-col gap-3">
          <h3 id="linter-findings-heading" className="text-lg font-bold">Linter findings</h3>
          <ul className="flex flex-col gap-3">
            {findings.map((finding, index) => (
              <li key={`${finding.file}:${finding.line}:${finding.rule}:${index}`}>
                <LinterFindingCard finding={finding} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {diagnostics.length > 0 && (
        <section aria-labelledby="linter-limitations-heading" className="flex flex-col gap-3">
          <h3 id="linter-limitations-heading" className="text-lg font-bold">Linter limitations</h3>
          <ul className="flex flex-col gap-3">
            {diagnostics.map((diagnostic, index) => (
              <li key={`${diagnostic.file}:${diagnostic.reason}:${index}`}>
                <LinterDiagnosticCard diagnostic={diagnostic} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function LinterFindingCard({ finding }: { finding: LinterFinding }) {
  const id = useId();
  const severity = severityFor(finding.rule);

  return (
    <article
      tabIndex={0}
      aria-labelledby={`${id}-rule`}
      className={`rounded-lg border border-rule bg-sheet p-4 ${focusRing}`}
    >
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded border border-rule bg-paper px-2 py-0.5 font-bold">Linter</span>
        <span>Severity: {severity}</span>
      </p>
      <h4 id={`${id}-rule`} className="mt-2 break-all font-mono text-sm font-bold">{finding.rule}</h4>
      <p className="mt-2">{finding.message}</p>
      <p className="mt-2 break-all font-mono text-sm text-ink/70">
        {finding.file}, line {finding.line}
      </p>
    </article>
  );
}

function LinterDiagnosticCard({ diagnostic }: { diagnostic: LinterDiagnostic }) {
  const id = useId();

  return (
    <article
      tabIndex={0}
      aria-labelledby={`${id}-title`}
      className={`rounded-lg border border-rule bg-paper p-4 ${focusRing}`}
    >
      <p className="text-sm font-bold">Linter limitation · {diagnosticLabel(diagnostic.reason)}</p>
      <h4 id={`${id}-title`} className="mt-2 font-bold">Could not lint this file</h4>
      <p className="mt-1 break-all font-mono text-sm text-ink/70">{diagnostic.file}</p>
      <p className="mt-2">{diagnostic.message}</p>
      {diagnostic.line !== undefined && (
        <p className="mt-1 text-sm text-ink/70">
          Location: line {diagnostic.line}
          {diagnostic.column === undefined ? "" : `, column ${diagnostic.column}`}
        </p>
      )}
      <p className="mt-2 text-sm text-ink/70">This is a linter limitation, not a model code finding.</p>
    </article>
  );
}
