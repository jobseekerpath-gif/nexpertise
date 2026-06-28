import { Router, type IRouter, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { AiChatBody } from "@workspace/api-zod";

const router: IRouter = Router();

// Models in fallback order — 2.5-flash first (best), then 1.5-flash (1500 RPD free tier)
const GEMINI_MODEL_CHAIN = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash-lite"] as const;
const ANTHROPIC_MODEL_CHAIN = ["claude-haiku-4-5", "claude-sonnet-4-5", "claude-sonnet-4-6"] as const;

function getAnthropicModelChain(maxTokens: number) {
  // Always start with the cheapest model. Only escalate to bigger models on rate limits.
  if (maxTokens <= 160) {
    return ["claude-haiku-4-5"] as const;
  }
  return ANTHROPIC_MODEL_CHAIN;
}

export function getAI() {
  // Support both underscore and space variants (Replit sometimes stores secrets with spaces)
  const apiKey = process.env["GEMINI_API_KEY"] ?? process.env["GEMINI API KEY"];
  if (!apiKey) throw new Error("Gemini API key is not configured. Set GEMINI_API_KEY in secrets.");
  return new GoogleGenAI({ apiKey });
}

function getAnthropic() {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
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
  return e?.status === 429 || e?.status === 503 || e?.status === 529;
}

function isAuthError(err: unknown): boolean {
  const e = err as { status?: number };
  return e?.status === 401 || e?.status === 403;
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

async function streamGemini(
  req: Request,
  res: Response,
  prompt: string,
  system?: string | null,
  maxTokens = 8192,
) {
  const ai = getAI();
  const contents = buildContents(prompt, system);

  for (let i = 0; i < GEMINI_MODEL_CHAIN.length; i++) {
    const model = GEMINI_MODEL_CHAIN[i]!;
    try {
      const stream = await ai.models.generateContentStream({
        model,
        contents,
        config: { maxOutputTokens: maxTokens },
      });
      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      return;
    } catch (err) {
      const isLast = i === GEMINI_MODEL_CHAIN.length - 1;
      if (isRateLimit(err) && !isLast) {
        req.log.warn({ model, err }, "Rate limited — trying fallback model");
        const delay = retryDelayMs(err);
        if (delay < 5000) await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

async function streamAnthropic(
  req: Request,
  res: Response,
  prompt: string,
  system?: string | null,
  maxTokens = 8192,
) {
  const anthropic = getAnthropic();
  if (!anthropic) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const messages: Array<{ role: "user"; content: string }> = [{ role: "user", content: prompt }];
  const systemPrompt = system ?? undefined;
  const modelChain = getAnthropicModelChain(maxTokens);

  for (let i = 0; i < modelChain.length; i++) {
    const model = modelChain[i]!;
    try {
      const stream = anthropic.messages.stream({
        model,
        max_tokens: maxTokens,
        messages,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        // Keep context cheap: don't let Claude waste tokens on long preambles
        // 1024 is plenty for UI-driven tasks (question, feedback, short report)
      });

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      return;
    } catch (err) {
      const isLast = i === modelChain.length - 1;
      if ((isRateLimit(err) || isAuthError(err)) && !isLast) {
        req.log.warn({ model, err }, "Claude issue — trying fallback model");
        continue;
      }
      throw err;
    }
  }
}

router.post("/ai/stream", async (req, res) => {
  const parseResult = AiChatBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { prompt, system, maxTokens } = parseResult.data;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const hasClaudeKey = Boolean(process.env["ANTHROPIC_API_KEY"]);

  try {
    // Always try Gemini first; Claude is the fallback when all Gemini models fail
    try {
      await streamGemini(req, res, prompt, system, maxTokens ?? 8192);
      return;
    } catch (geminiErr) {
      if (!hasClaudeKey) throw geminiErr;
      req.log.warn({ err: geminiErr }, "All Gemini models failed — falling back to Claude");
      await streamAnthropic(req, res, prompt, system, maxTokens ?? 8192);
    }
  } catch (err) {
    req.log.error({ err }, "AI streaming error");
    res.write(`data: ${JSON.stringify({ error: userFriendlyError(err) })}\n\n`);
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

  const hasClaudeKey = Boolean(process.env["ANTHROPIC_API_KEY"]);

  try {
    if (hasClaudeKey) {
      const anthropic = getAnthropic();
      if (!anthropic) throw new Error("ANTHROPIC_API_KEY is not configured");
      const modelChain = getAnthropicModelChain(maxTokens ?? 8192);

      for (let i = 0; i < modelChain.length; i++) {
        const model = modelChain[i]!;
        try {
          const response = await anthropic.messages.create({
            model,
            max_tokens: maxTokens ?? 1024,
            messages: [{ role: "user", content: prompt }],
            ...(system ? { system } : {}),
          });
          const block = response.content.find((part) => part.type === "text");
          res.json({ text: block?.text ?? "" });
          return;
        } catch (err) {
          const isLast = i === modelChain.length - 1;
          if ((isRateLimit(err) || isAuthError(err)) && !isLast) {
            req.log.warn({ model, err }, "Claude issue — trying fallback model");
            continue;
          }
          throw err;
        }
      }
    } else {
      const ai = getAI();
      const contents = buildContents(prompt, system);

      for (let i = 0; i < GEMINI_MODEL_CHAIN.length; i++) {
        const model = GEMINI_MODEL_CHAIN[i]!;
        try {
          const response = await ai.models.generateContent({
            model,
            contents,
            config: { maxOutputTokens: maxTokens ?? 8192 },
          });
          res.json({ text: response.text ?? "" });
          return;
        } catch (err) {
          const isLast = i === GEMINI_MODEL_CHAIN.length - 1;
          if (isRateLimit(err) && !isLast) {
            req.log.warn({ model, err }, "Rate limited — trying fallback model");
            continue;
          }
          throw err;
        }
      }
    }
  } catch (err) {
    req.log.error({ err }, "AI request error");
    res.status(503).json({ error: userFriendlyError(err) });
  }
});

export default router;
