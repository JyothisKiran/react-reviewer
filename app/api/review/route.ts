import { GoogleGenAI } from "@google/genai";
import { GEM_INSTRUCTIONS } from "@/prompts/gem";
import { MAX_FILES, MAX_TOTAL_CHARS, totalChars, type SourceFile } from "@/lib/files";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = "gemini-3.5-flash"; // keep whichever model worked for you in v0

function checkFiles(files: unknown): string | null {
  if (!Array.isArray(files) || files.length === 0) return "Add at least one file to review.";
  if (files.length > MAX_FILES) return `You can review up to ${MAX_FILES} files at a time.`;
  const readable = files.every((f) => typeof f?.path === "string" && typeof f?.content === "string");
  if (!readable) return "Some files couldn't be read. Remove them and try again.";
  if (totalChars(files) > MAX_TOTAL_CHARS) {
    return "These files are too large to review together. Remove a few and try again.";
  }
  return null;
}

function buildPrompt(files: SourceFile[]) {
  const intro =
    files.length === 1
      ? "Review this file."
      : `Review these ${files.length} files together. Look at how they work with each other, not only at each file on its own.`;
  const blocks = files.map((f) => `<file path="${f.path}">\n${f.content}\n</file>`).join("\n\n");
  return `${intro}\n\n${blocks}`;
}

function toTextStream(chunks: AsyncIterable<{ text?: string }>) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of chunks) {
          if (chunk.text) controller.enqueue(encoder.encode(chunk.text));
        }
      } catch (error) {
        console.error(error);
        controller.enqueue(
          encoder.encode("\n\n---\n\n**The review stopped partway through. Run it again to get the full review.**")
        );
      } finally {
        controller.close();
      }
    },
  });
}

export async function POST(request: Request) {
  const { files } = await request.json().catch(() => ({ files: null }));

  const problem = checkFiles(files);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  try {
    const stream = await ai.models.generateContentStream({
      model: MODEL,
      contents: buildPrompt(files),
      config: { systemInstruction: GEM_INSTRUCTIONS },
    });
    return new Response(toTextStream(stream), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Couldn't reach Gemini. Check the terminal for details, then try again." },
      { status: 502 }
    );
  }
}