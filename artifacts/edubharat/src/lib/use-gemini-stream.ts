import { useState, useCallback } from "react";

async function* parseSSE(response: Response): AsyncGenerator<string> {
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
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
      } catch {
        // skip malformed lines
      }
    }
  }
}

export function useGeminiStream() {
  const [text, setText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stream = useCallback(
    async (
      prompt: string,
      system?: string,
      onChunk?: (chunk: string, fullText: string) => void
    ): Promise<string> => {
      setIsStreaming(true);
      setText("");
      setError(null);

      try {
        const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
        const response = await fetch(`${base}/api/ai/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, system }),
          credentials: "include",
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        let fullText = "";
        for await (const chunk of parseSSE(response)) {
          fullText += chunk;
          setText(fullText);
          onChunk?.(chunk, fullText);
        }
        return fullText;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "AI request failed";
        setError(msg);
        return "";
      } finally {
        setIsStreaming(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setText("");
    setError(null);
  }, []);

  return { text, isStreaming, error, stream, reset };
}
