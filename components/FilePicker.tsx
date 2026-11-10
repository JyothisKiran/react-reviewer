"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { MAX_FILES, MAX_TOTAL_CHARS, readFiles, toKB, totalChars, type SourceFile } from "@/lib/files";

const secondaryButton =
  "rounded-md border border-rule bg-sheet px-3 py-1.5 text-sm font-bold hover:border-pencil focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pencil disabled:opacity-50";
const field =
  "w-full rounded-md border border-rule bg-sheet px-3 py-2 font-mono text-sm focus-visible:outline-2 focus-visible:outline-pencil";

type Props = {
  files: SourceFile[];
  onAdd: (files: SourceFile[]) => void;
  onRemove: (path: string) => void;
  onClear: () => void;
  disabled: boolean;
};

export function FilePicker({ files, onAdd, onRemove, onClear, disabled }: Props) {
  const filesInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [skipped, setSkipped] = useState(0);

  // React doesn't type the folder-picker attribute, so set it directly
  useEffect(() => {
    folderInput.current?.setAttribute("webkitdirectory", "");
  }, []);

  async function add(picked: File[]) {
    const read = await readFiles(picked);
    setSkipped(picked.length - read.length);
    onAdd(read);
  }

  function handlePick(input: HTMLInputElement) {
    const picked = Array.from(input.files ?? []);
    input.value = ""; // lets you pick the same file again later
    void add(picked);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (!disabled) void add(Array.from(e.dataTransfer.files));
  }

  const used = totalChars(files);
  const overLimit = used > MAX_TOTAL_CHARS || files.length > MAX_FILES;

  return (
    <section aria-labelledby="files-heading" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 id="files-heading" className="text-lg font-bold">Files to review</h2>
        {files.length > 0 && (
          <button type="button" onClick={onClear} disabled={disabled}
            className="text-sm text-pencil underline-offset-4 hover:underline disabled:opacity-50">
            Clear all
          </button>
        )}
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
          dragging ? "border-pencil bg-highlight" : "border-rule bg-sheet"
        }`}
      >
        <p>Drop files here</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => filesInput.current?.click()} disabled={disabled} className={secondaryButton}>
            Choose files
          </button>
          <button type="button" onClick={() => folderInput.current?.click()} disabled={disabled} className={secondaryButton}>
            Choose a folder
          </button>
        </div>
        <input ref={filesInput} type="file" multiple hidden onChange={(e) => handlePick(e.target)} />
        <input ref={folderInput} type="file" hidden onChange={(e) => handlePick(e.target)} />
      </div>

      {files.length > 0 && (
        <ul className="max-h-72 divide-y divide-rule overflow-y-auto rounded-lg border border-rule bg-sheet">
          {files.map((f) => (
            <li key={f.path} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="truncate font-mono text-sm" title={f.path}>{f.path}</span>
              <button type="button" onClick={() => onRemove(f.path)} disabled={disabled}
                aria-label={`Remove ${f.path}`}
                className="shrink-0 text-sm text-ink/60 hover:text-ink disabled:opacity-50">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className={`text-sm ${overLimit ? "text-red-700" : "text-ink/70"}`}>
        {files.length} of {MAX_FILES} files, {toKB(used)} of {toKB(MAX_TOTAL_CHARS)} KB
        {overLimit && ". Remove some files to review the rest together."}
      </p>
      {skipped > 0 && (
        <p className="text-sm text-ink/70">
          Skipped {skipped} {skipped === 1 ? "file" : "files"} that are not source code, such as images,
          lockfiles and node_modules.
        </p>
      )}

      <details className="rounded-lg border border-rule bg-sheet px-3 py-2">
        <summary className="cursor-pointer text-sm font-bold">Paste a snippet instead</summary>
        <SnippetForm onAdd={(file) => onAdd([file])} disabled={disabled} />
      </details>
    </section>
  );
}

function SnippetForm({ onAdd, disabled }: { onAdd: (file: SourceFile) => void; disabled: boolean }) {
  const [path, setPath] = useState("Component.tsx");
  const [content, setContent] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onAdd({ path: path.trim() || "snippet.tsx", content });
        setContent("");
      }}
      className="mt-3 flex flex-col gap-2"
    >
      <label htmlFor="snippet-name" className="text-sm">File name</label>
      <input id="snippet-name" value={path} onChange={(e) => setPath(e.target.value)} className={field} />
      <label htmlFor="snippet-code" className="text-sm">Code</label>
      <textarea id="snippet-code" value={content} onChange={(e) => setContent(e.target.value)} rows={8} className={field} />
      <button type="submit" disabled={disabled || !content.trim()} className={secondaryButton}>
        Add snippet
      </button>
    </form>
  );
}