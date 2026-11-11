const RANK = { suggestion: 0, low: 1, medium: 2, high: 3, critical: 4 };

module.exports = (output, context) => {
  const review = typeof output === "string" ? JSON.parse(output) : output;
  const exp = context.vars.expect;
  const findings = review.findings ?? [];

  if (exp.type === "issue") {
    const hit = findings.find(
      (f) =>
        exp.categories.includes(f.category) &&
        f.line >= exp.lines[0] && f.line <= exp.lines[1] &&
        RANK[f.severity] >= RANK[exp.minSeverity]
    );
    return { pass: !!hit, score: hit ? 1 : 0, reason: hit ? `Caught: ${hit.title}` : "Missed planted issue" };
  }

  // clean / dedupe cases: nothing at medium or above, and nothing repeating the linter
  const noisy = findings.filter((f) => RANK[f.severity] >= RANK.medium);
  const dup = exp.linterLine
    ? findings.filter((f) => f.line === exp.linterLine && f.category === exp.linterCategory)
    : [];
  const bad = [...new Set([...noisy, ...dup])];
  return { pass: bad.length === 0, score: bad.length ? 0 : 1,
           reason: bad.length ? `False positives: ${bad.map((f) => f.title).join("; ")}` : "Clean" };
};
