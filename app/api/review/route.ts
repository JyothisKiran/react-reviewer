import { GoogleGenAI } from "@google/genai";
import { GEM_INSTRUCTIONS } from "@/prompts/gem";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = "gemini-3.5-flash"; // if this errors, use a model name listed in AI Studio

export async function POST(request: Request) {
  const { code } = await request.json();

  if (typeof code !== "string" || code.trim() === "") {
    return Response.json({ error: "Please paste some code first." }, { status: 400 });
  }

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: `Please review this code:\n\n${code}`,
      config: { systemInstruction: GEM_INSTRUCTIONS },
    });
    return Response.json({ review: response.text });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "The review failed. Check the terminal for details." },
      { status: 500 }
    );
  }
}