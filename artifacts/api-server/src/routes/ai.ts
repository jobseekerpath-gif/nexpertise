import { Router, type IRouter } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { AiChatBody } from "@workspace/api-zod";

const router: IRouter = Router();

const anthropic = new Anthropic({
  apiKey: process.env["ANTHROPIC_API_KEY"],
});

router.post("/ai/chat", async (req, res) => {
  const parseResult = AiChatBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { prompt, maxTokens, system } = parseResult.data;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: maxTokens ?? 1024,
      ...(system ? { system } : {}),
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const text =
      message.content[0]?.type === "text" ? message.content[0].text : "";

    res.json({ text });
  } catch (err) {
    req.log.error({ err }, "Anthropic API error");
    res.status(500).json({ error: "AI request failed" });
  }
});

export default router;
