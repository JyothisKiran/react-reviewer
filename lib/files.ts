export type SourceFile = { path: string; content: string };

export const MAX_FILES = 30;
export const MAX_TOTAL_CHARS = 200_000;

const CODE_FILE = /\.(tsx?|jsx?|mjs|cjs|css|scss|json|md)$/i;
const SKIPPED_PATH = /(^|\/)(node_modules|\.next|dist|build|coverage|\.git)\//;
const LOCKFILE = /package-lock\.json$/;

function pathOf(file: File) {
  return file.webkitRelativePath || file.name;
}

export function isReviewable(path: string) {
  return CODE_FILE.test(path) && !SKIPPED_PATH.test(path) && !LOCKFILE.test(path);
}

export async function readFiles(files: File[]): Promise<SourceFile[]> {
  const reviewable = files.filter((f) => isReviewable(pathOf(f)));
  return Promise.all(reviewable.map(async (f) => ({ path: pathOf(f), content: await f.text() })));
}

export function mergeFiles(current: SourceFile[], added: SourceFile[]) {
  const byPath = new Map(current.map((f) => [f.path, f]));
  for (const f of added) byPath.set(f.path, f);
  return [...byPath.values()];
}

export function totalChars(files: SourceFile[]) {
  return files.reduce((sum, f) => sum + f.content.length, 0);
}

export const toKB = (chars: number) => Math.ceil(chars / 1000);