import { Router, type IRouter } from "express";
import { GoogleGenAI, type GoogleGenAIError } from "@google/genai";
import { AiChatBody } from "@workspace/api-zod";

const router: IRouter = Router();

// Models in fallback order — 2.5-flash first (best), then 1.5-flash (1500 RPD free tier)
const MODEL_CHAIN = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash-lite"] as const;

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

function isRateLimit(err: unknown): boolean {
  const e = err as { status?: number };
  return e?.status === 429 || e?.status === 503;
}

function retryDelayMs(err: unknown): number {
  try {
    const msg = (err as { message?: string }).message ?? "";
    const match = msg.match(/"retryDelay":\s*"(\d+)s"/);
    if (match) return Math.min(parseInt(match[1]) * 1000, 8000);
  } catch { /* ignore */ }
  return 3000;
}

function userFriendlyError(err: unknown): string {
  const e = err as { status?: number; message?: string };
  if (e?.status === 429) {
    const match = e.message?.match(/retry in ([\d.]+)s/i);
    const secs = match ? Math.ceil(parseFloat(match[1])) : 30;
    return `AI quota reached — please wait ${secs} seconds and try again.`;
  }
  if (e?.status === 503) return "AI is temporarily busy — please try again in a moment.";
  return "AI request failed — please try again.";
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

  const ai = getAI();
  const contents = buildContents(prompt, system);

  for (let i = 0; i < MODEL_CHAIN.length; i++) {
    const model = MODEL_CHAIN[i]!;
    try {
      const stream = await ai.models.generateContentStream({
        model,
        contents,
        config: { maxOutputTokens: 8192 },
      });
      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      return;
    } catch (err) {
      const isLast = i === MODEL_CHAIN.length - 1;
      if (isRateLimit(err) && !isLast) {
        req.log.warn({ model, err }, "Rate limited — trying fallback model");
        const delay = retryDelayMs(err);
        if (delay < 5000) await new Promise(r => setTimeout(r, delay));
        continue;
      }
      req.log.error({ model, err }, "Gemini streaming error");
      res.write(`data: ${JSON.stringify({ error: userFriendlyError(err) })}\n\n`);
      res.end();
      return;
    }
  }
});

router.post("/ai/chat", async (req, res) => {
  const parseResult = AiChatBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { prompt, maxTokens, system } = parseResult.data;
  const ai = getAI();
  const contents = buildContents(prompt, system);

  for (let i = 0; i < MODEL_CHAIN.length; i++) {
    const model = MODEL_CHAIN[i]!;
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: { maxOutputTokens: maxTokens ?? 8192 },
      });
      res.json({ text: response.text ?? "" });
      return;
    } catch (err) {
      const isLast = i === MODEL_CHAIN.length - 1;
      if (isRateLimit(err) && !isLast) {
        req.log.warn({ model, err }, "Rate limited — trying fallback model");
        continue;
      }
      req.log.error({ model, err }, "Gemini API error");
      res.status(503).json({ error: userFriendlyError(err) });
      return;
    }
  }
});

export default router;
