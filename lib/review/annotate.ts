export type AnnotateInput = { path: string; content: string };

/** File path -> (new-file line number -> line text). Only these lines can be commented on. */
export type AddedLines = Map<string, Map<number, string>>;

/** Splits like an editor numbers lines: a trailing newline doesn't start another line. */
export function splitLines(content: string): string[] {
  if (content === "") return [];
  const lines = content.split(/\r\n|\r|\n/);
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/**
 * Builds the annotated diff the user template expects. Uploaded files have no base
 * version, so every line is an added line: "+ N | code".
 */
export function annotate(files: AnnotateInput[]) {
  const addedLines: AddedLines = new Map();

  const blocks = files.map(({ path, content }) => {
    const lines = splitLines(content);
    addedLines.set(path, new Map(lines.map((text, i) => [i + 1, text])));
    const body = lines.map((text, i) => (text ? `+ ${i + 1} | ${text}` : `+ ${i + 1} |`));
    return [`### ${path}`, ...body].join("\n");
  });

  return { annotatedDiff: blocks.join("\n\n"), addedLines };
}
