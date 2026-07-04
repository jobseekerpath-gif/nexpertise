import { useState, useCallback, useRef } from "react";

export type StreamOptions = {
  maxTokens?: number;
};

async function* parseSSE(response: Response, signal: AbortSignal): AsyncGenerator<string> {
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(line.slice(6)) as { content?: string; done?: boolean; error?: string };
          if (data.error) throw new Error(data.error);
          if (data.done) return;
          if (data.content) yield data.content;
        } catch (e) {
          if (e instanceof Error && e.message !== "Unexpected end of JSON input") throw e;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function useGeminiStream() {
  const [text, setText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stream = useCallback(
    async (
      prompt: string,
      system?: string,
      onChunk?: (chunk: string, fullText: string) => void,
      options?: StreamOptions,
    ): Promise<string> => {
      // Cancel any in-flight stream before starting a new one
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsStreaming(true);
      setText("");
      setError(null);

      try {
        const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
        const response = await fetch(`${base}/api/ai/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Clamp default token budget for all UI streams to keep Claude/Gemini calls cheap
          body: JSON.stringify({ prompt, system, maxTokens: options?.maxTokens ?? 1200 }),
          credentials: "include",
          signal: controller.signal,
        });

        if (!response.ok) throw new Error(`Server error ${response.status}`);

        let fullText = "";
        for await (const chunk of parseSSE(response, controller.signal)) {
          fullText += chunk;
          setText(fullText);
          onChunk?.(chunk, fullText);
        }
        return fullText;
      } catch (err) {
        // AbortError is intentional (user cancelled / language change) — don't surface as error
        if (err instanceof Error && err.name === "AbortError") return "";
        const raw = err instanceof Error ? err.message : "AI request failed";
        // Surface friendly quota/rate messages directly
        const friendly = raw.includes("quota") || raw.includes("wait") || raw.includes("busy")
          ? raw
          : "AI request failed — please try again.";
        setError(friendly);
        return "";
      } finally {
        setIsStreaming(false);
      }
    },
    []
  );

  /**
   * reset — clears visible text/error AND cancels any in-flight stream so
   * isStreaming is set to false immediately (via the stream's finally block).
   * Safe to call even when no stream is running.
   */
  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setText("");
    setError(null);
    // isStreaming is cleared by the aborted stream's finally block;
    // if no stream is running it's already false, so nothing to do.
  }, []);

  return { text, isStreaming, error, stream, reset };
}
