// Summarises promptfoo results for evals/RESULTS.md.
// Usage: node evals/summarize.js <results.json> [more-results.json ...]
//
// Several files are combined per case, so a run can be split (e.g. across free-tier days):
// a later file's result replaces an earlier one, except that an error never replaces a
// scored result.
//
// Recall, noisy and errors come straight from promptfoo (assert.js decides pass/fail).
// "Partial" and the dropped-finding analysis use the same "in the expected lines" rule
// as assert.js: a finding's start line is inside expect.lines.
const fs = require("node:fs");

const RANK = { suggestion: 0, low: 1, medium: 2, high: 3, critical: 4 };
const LINTER_CASE = "09"; // left out of the false-positive rate until v3

const files = process.argv.slice(2);
if (!files.length) {
  console.error("Usage: node evals/summarize.js <results.json> [more-results.json ...]");
  process.exit(1);
}

const caseOf = (r) => (r.testCase?.description ?? "").match(/^\d+/)?.[0] ?? "??";
const isError = (r) => Boolean(r.response?.error) || r.response?.output === undefined;

const byCase = new Map();
const timestamps = [];
for (const f of files) {
  const data = JSON.parse(fs.readFileSync(f, "utf8"));
  timestamps.push(data.results.timestamp);
  for (const r of data.results.results) {
    const previous = byCase.get(caseOf(r));
    if (!previous || !isError(r) || isError(previous)) byCase.set(caseOf(r), r);
  }
}
const rows = [...byCase.values()];
const file = files.join(" + ");
const data = { results: { timestamp: timestamps.join(", ") } };

const nameOf = (r) => r.testCase?.description ?? caseOf(r);
const metaOf = (r) => r.response?.metadata ?? r.metadata ?? {};
const inLines = (f, [start, end]) => f.line >= start && f.line <= end;
const describe = (f) => `${f.severity} ${f.category} L${f.line}${f.endLine && f.endLine !== f.line ? `–${f.endLine}` : ""} "${f.title}"`;
const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : "n/a");

function reviewOf(r) {
  try {
    return JSON.parse(r.response?.output);
  } catch {
    return null;
  }
}

/** Why an in-range finding didn't count as a catch. */
function mismatch(f, exp) {
  const categoryOk = exp.categories.includes(f.category);
  const severityOk = RANK[f.severity] >= RANK[exp.minSeverity];
  if (categoryOk && severityOk) return null;
  if (!categoryOk && !severityOk) return "category + severity";
  return categoryOk ? "severity" : "category";
}

const errors = [];
const planted = { total: 0, caught: [], partial: [], missed: [] };
const clean = { total: 0, noisy: [], linter: null };
const dropTotals = { "low-confidence": 0, ungrounded: 0, "over-cap": 0 };
let rawFindings = 0;
let calls = 0;
let validationRetries = 0;
const models = new Set();

for (const r of rows.sort((a, b) => caseOf(a).localeCompare(caseOf(b)))) {
  const exp = r.vars.expect;
  const id = caseOf(r);
  const review = reviewOf(r);
  const meta = metaOf(r);
  const dropped = meta.dropped ?? [];

  if (exp.type === "issue") planted.total++;
  else if (id !== LINTER_CASE) clean.total++;

  if (r.response?.error || !review) {
    errors.push({ id, name: nameOf(r), error: r.response?.error ?? r.error ?? "No output" });
    continue;
  }

  rawFindings += review.findings.length + dropped.length;
  for (const d of dropped) dropTotals[d.reason] = (dropTotals[d.reason] ?? 0) + 1;
  calls += meta.meta?.calls ?? 0;
  validationRetries += meta.meta?.validationRetries ?? 0;
  if (meta.meta?.modelVersion) models.add(meta.meta.modelVersion);

  if (exp.type === "issue") {
    if (r.success) {
      planted.caught.push({ id });
      continue;
    }
    const near = review.findings
      .filter((f) => inLines(f, exp.lines))
      .map((f) => ({ finding: f, reason: mismatch(f, exp) }))
      // A single mismatch is closer than both.
      .sort((a, b) => (a.reason === "category + severity") - (b.reason === "category + severity"));
    const droppedNear = dropped
      .filter((d) => inLines(d.finding, exp.lines))
      .map((d) => ({ ...d, wouldCatch: mismatch(d.finding, exp) === null }));
    const entry = { id, name: nameOf(r), exp, near, droppedNear };
    (near.length ? planted.partial : planted.missed).push(entry);
  } else {
    const bad = review.findings.filter((f) => RANK[f.severity] >= RANK.medium || (exp.linterLine && f.line === exp.linterLine && f.category === exp.linterCategory));
    const entry = { id, name: nameOf(r), pass: r.success, bad };
    if (id === LINTER_CASE) clean.linter = entry;
    else if (!r.success) clean.noisy.push(entry);
  }
}

const lines = [];
const out = (s = "") => lines.push(s);

out(`# ${file}`);
out(`Run: ${data.results.timestamp} · cases: ${rows.length} · models: ${[...models].join(", ") || "n/a"} · Gemini calls: ${calls} · validation retries: ${validationRetries}`);
out();
if (errors.length) {
  out(`**Incomplete run: ${errors.length} case(s) errored and weren't scored. Rerun them before recording results.**`);
  for (const e of errors) out(`- ${e.name}: ${String(e.error).split("\n")[0].slice(0, 160)}`);
  out();
}

const partialReasons = planted.partial.map((p) => p.near[0].reason);
const reasonCount = (reason) => partialReasons.filter((x) => x === reason).length;

out(`Recall: ${planted.caught.length}/${planted.total} (${pct(planted.caught.length, planted.total)})`);
out(`Partial: ${planted.partial.length} (severity: ${reasonCount("severity")}, category: ${reasonCount("category")}, both: ${reasonCount("category + severity")})`);
out(`False-positive rate: ${clean.noisy.length}/${clean.total} (${pct(clean.noisy.length, clean.total)}), excluding case ${LINTER_CASE}`);
out(`Dropped: ${dropTotals["low-confidence"]} low-confidence, ${dropTotals.ungrounded} ungrounded, ${dropTotals["over-cap"]} over cap, of ${rawFindings} raw findings`);
out();

if (planted.partial.length) {
  out("## Partial (flagged in the expected lines, but not counted)");
  for (const p of planted.partial) {
    const best = p.near[0];
    out(`- ${p.name} — reason: ${best.reason}. Expected ${p.exp.categories.join("/")} ≥ ${p.exp.minSeverity}; got ${describe(best.finding)}`);
  }
  out();
}

if (planted.missed.length || planted.partial.some((p) => p.droppedNear.length)) {
  out("## Missed, and whether postprocess dropped it");
  for (const p of [...planted.missed, ...planted.partial]) {
    const status = planted.missed.includes(p) ? "missed" : "partial";
    if (!p.droppedNear.length) {
      if (status === "missed") out(`- ${p.name} (missed): not in the model's raw findings either.`);
      continue;
    }
    for (const d of p.droppedNear) {
      out(`- ${p.name} (${status}): dropped as ${d.reason}${d.wouldCatch ? ", and would have counted as caught" : ""}. ${d.detail} Finding: ${describe(d.finding)}`);
    }
  }
  out();
}

if (clean.noisy.length) {
  out("## Noisy clean cases");
  for (const n of clean.noisy) out(`- ${n.name}: ${n.bad.map(describe).join("; ")}`);
  out();
}

if (clean.linter) {
  out(`## Case ${LINTER_CASE} (linter dedupe, not in the rate)`);
  out(`- ${clean.linter.pass ? "Passed" : `Failed: ${clean.linter.bad.map(describe).join("; ")}`}`);
  out();
}

console.log(lines.join("\n"));
