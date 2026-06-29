/**
 * useEdgeTTS — Microsoft Edge Neural TTS via the API server.
 *
 * Produces natural Indian-accented speech for 13 languages with real
 * male / female neural voices. Same interface as useSpeechSynthesis so
 * pages can swap with minimal changes.
 */
import { useState, useRef, useCallback } from "react";

export type VoiceGender = "male" | "female" | "auto";

export type EdgeSpeakOptions = {
  voiceGender?: VoiceGender;
  /** playbackRate multiplier — default 1.0 (Edge voices are already natural speed) */
  rate?: number;
  /** ignored for Edge TTS (pitch is set by the neural model, not adjustable) */
  pitch?: number;
  voiceStyle?: string; // kept for API compatibility, unused
};

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

export function useEdgeTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef  = useRef<HTMLAudioElement | null>(null);
  const abortRef  = useRef<AbortController | null>(null);
  // Track the object URL so we can revoke it
  const urlRef    = useRef<string | null>(null);

  const stop = useCallback(() => {
    // Cancel any in-flight fetch
    abortRef.current?.abort();
    abortRef.current = null;
    // Stop & release the audio element
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.src = "";
      audioRef.current = null;
    }
    // Release the blob URL
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    async (
      text: string,
      language = "English",
      onEnd?: () => void,
      options: EdgeSpeakOptions = {},
    ) => {
      if (!text.trim()) { onEnd?.(); return; }

      // Stop any currently playing audio first
      stop();

      const gender: "male" | "female" =
        options.voiceGender === "male" ? "male" : "female";

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const res = await fetch(`${BASE}/api/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ text: text.trim(), language, gender }),
          signal: ctrl.signal,
        });

        if (!res.ok || ctrl.signal.aborted) {
          onEnd?.();
          return;
        }

        const blob = await res.blob();
        if (ctrl.signal.aborted) { onEnd?.(); return; }

        const url = URL.createObjectURL(blob);
        urlRef.current = url;

        const audio = new Audio(url);
        audioRef.current = audio;

        // Edge voices are already at natural speed; small adjustment allowed
        const rate = options.rate;
        if (rate && rate !== 1.0) audio.playbackRate = Math.max(0.8, Math.min(rate, 1.2));

        setIsSpeaking(true);

        const cleanup = () => {
          URL.revokeObjectURL(url);
          if (urlRef.current === url) urlRef.current = null;
          if (audioRef.current === audio) audioRef.current = null;
          setIsSpeaking(false);
          onEnd?.();
        };

        audio.onended = cleanup;
        audio.onerror = cleanup;

        try {
          await audio.play();
        } catch (playErr: unknown) {
          // autoplay blocked or device error — release all refs cleanly
          cleanup();
        }
      } catch (err: unknown) {
        if ((err as Error)?.name !== "AbortError") {
          // Release any partially-created URL
          if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
          audioRef.current = null;
          setIsSpeaking(false);
          onEnd?.();
        }
      }
    },
    [stop],
  );

  return {
    isSpeaking,
    isSupported: true as const,
    speak,
    stop,
  };
}
