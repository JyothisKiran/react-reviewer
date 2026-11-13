import { describe, expect, it } from "vitest";
import { z } from "zod";
import { isGeminiSchemaKeyword, reviewJsonSchema } from "./gemini";
import { FindingSchema, ReviewSchema } from "./schema";

type Node = Record<string, unknown>;
const SUBSCHEMA_KEYS = ["items", "additionalProperties"];
const SUBSCHEMA_LIST_KEYS = ["anyOf", "oneOf", "prefixItems"];
const SUBSCHEMA_MAP_KEYS = ["properties", "$defs"];

/** Every keyword used anywhere in a JSON Schema. */
function keywords(node: unknown, found = new Set<string>()): Set<string> {
  if (!node || typeof node !== "object") return found;
  for (const [key, value] of Object.entries(node as Node)) {
    found.add(key);
    if (SUBSCHEMA_KEYS.includes(key)) keywords(value, found);
    if (SUBSCHEMA_LIST_KEYS.includes(key)) (value as unknown[]).forEach((v) => keywords(v, found));
    if (SUBSCHEMA_MAP_KEYS.includes(key)) Object.values(value as Node).forEach((v) => keywords(v, found));
  }
  return found;
}

type ZodDef = {
  type: string;
  checks?: { _zod: { def: { check: string } } }[];
  shape?: Record<string, z.ZodType>;
  element?: z.ZodType;
  innerType?: z.ZodType;
};

/** Paths to constraints JSON Schema can't express: refinements and transforms. */
function hiddenConstraints(schema: z.ZodType, path = "$"): string[] {
  const def = schema._zod.def as unknown as ZodDef;
  const found: string[] = [];
  if (def.checks?.some((c) => c._zod.def.check === "custom")) found.push(`${path} (refine)`);
  if (def.type === "pipe" || def.type === "transform") found.push(`${path} (${def.type})`);
  for (const [key, child] of Object.entries(def.shape ?? {})) found.push(...hiddenConstraints(child, `${path}.${key}`));
  if (def.element) found.push(...hiddenConstraints(def.element, `${path}[]`));
  if (def.innerType) found.push(...hiddenConstraints(def.innerType, path));
  return found;
}

describe("review JSON schema", () => {
  const schema = reviewJsonSchema();
  const finding = ((schema.properties as Node).findings as Node).items as Node;
  const props = finding.properties as Record<string, Node>;

  it("uses only keywords Gemini's responseJsonSchema supports", () => {
    expect([...keywords(schema)].filter((k) => !isGeminiSchemaKeyword(k))).toEqual([]);
  });

  it("lists properties in schema order on every object", () => {
    expect(schema.propertyOrdering).toEqual(Object.keys(ReviewSchema.shape));
    expect(finding.propertyOrdering).toEqual(Object.keys(FindingSchema.shape));
    expect((finding.propertyOrdering as string[]).slice(0, 4)).toEqual(["file", "line", "endLine", "evidence"]);
  });

  it("shows the model every constraint Zod enforces", () => {
    expect(props.confidence).toMatchObject({ type: "number", minimum: 0, maximum: 1 });
    expect(props.line).toMatchObject({ type: "integer", minimum: 1 });
    expect(props.endLine).toMatchObject({ type: "integer", minimum: 1 });
    expect(props.severity.enum).toEqual(["critical", "high", "medium", "low", "suggestion"]);
    expect(finding.required).not.toContain("endLine");
    expect(finding.required).not.toContain("suggestedCode");
    expect(finding.additionalProperties).toBe(false);
  });

  it("has no refinements or transforms the model can't see", () => {
    expect(hiddenConstraints(ReviewSchema)).toEqual([]);
    // The check itself works:
    expect(hiddenConstraints(z.object({ a: z.string().refine((s) => s.length > 1) }))).toEqual(["$.a (refine)"]);
  });
});
