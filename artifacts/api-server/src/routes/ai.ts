import { Router, type IRouter } from "express";
import { GoogleGenAI } from "@google/genai";
import { AiChatBody } from "@workspace/api-zod";

const router: IRouter = Router();

function getAI() {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  return new GoogleGenAI({ apiKey });
}

function buildContents(prompt: string, system?: string | null) {
  const contents: { role: string; parts: { text: string }[] }[] = [];
  if (system) {
    contents.push({ role: "user", parts: [{ text: system }] });
    contents.push({ role: "model", parts: [{ text: "Understood. I will follow these instructions." }] });
  }
  contents.push({ role: "user", parts: [{ text: prompt }] });
  return contents;
}

router.post("/ai/stream", async (req, res) => {
  const parseResult = AiChatBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { prompt, system } = parseResult.data;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const ai = getAI();
    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: buildContents(prompt, system),
      config: { maxOutputTokens: 8192 },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "Gemini streaming error");
    res.write(`data: ${JSON.stringify({ error: "AI request failed" })}\n\n`);
    res.end();
  }
});

router.post("/ai/chat", async (req, res) => {
  const parseResult = AiChatBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { prompt, maxTokens, system } = parseResult.data;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: buildContents(prompt, system),
      config: { maxOutputTokens: maxTokens ?? 8192 },
    });
    res.json({ text: response.text ?? "" });
  } catch (err) {
    req.log.error({ err }, "Gemini API error");
    res.status(500).json({ error: "AI request failed" });
  }
});

export default router;
