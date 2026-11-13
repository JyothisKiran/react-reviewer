import type { Severity } from "@/lib/review/constants";
import { SEVERITY_LABEL } from "@/lib/review/format";

// Literal class names so Tailwind can find them.
const BADGE: Record<Severity, string> = {
  critical: "bg-sev-critical",
  high: "bg-sev-high",
  medium: "bg-sev-medium",
  low: "bg-sev-low",
  suggestion: "bg-sev-suggestion",
};

export const SEVERITY_BORDER: Record<Severity, string> = {
  critical: "border-l-sev-critical",
  high: "border-l-sev-high",
  medium: "border-l-sev-medium",
  low: "border-l-sev-low",
  suggestion: "border-l-sev-suggestion",
};

/** Severity as text on a colour, never colour alone. */
export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white ${BADGE[severity]}`}>
      {SEVERITY_LABEL[severity]}
    </span>
  );
}
