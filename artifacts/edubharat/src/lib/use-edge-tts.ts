/**
 * useEdgeTTS — Microsoft Edge Neural TTS via the API server.
 *
 * Produces natural Indian-accented speech for 13 languages with real
 * male / female neural voices. Same interface as useSpeechSynthesis so
 * pages can swap with minimal changes.
 *
 * GLOBAL SINGLETON: All hook instances share a single Audio element so
 * English Guru and Interview Ace (or any two tools) can never speak
 * simultaneously — calling speak() anywhere immediately stops whatever
 * else is playing.
 */
import { useState, useEffect, useRef, useCallback } from "react";

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

// ---------------------------------------------------------------------------
// Module-level singleton — exactly one audio element and one AbortController
// across the entire app lifetime. Guarantees only one AI voice at a time.
// ---------------------------------------------------------------------------
let _audio: HTMLAudioElement | null = null;
let _abort: AbortController | null = null;
let _url:   string | null = null;
// Hook instances register here to be notified when global stop happens
// so they can reset their own isSpeaking state.
const _stopListeners = new Set<() => void>();

function globalStop() {
  _abort?.abort();
  _abort = null;
  if (_audio) {
    _audio.pause();
    _audio.onended = null;
    _audio.onerror = null;
    _audio.src    = "";
    _audio        = null;
  }
  if (_url) { URL.revokeObjectURL(_url); _url = null; }
  // Notify all mounted hook instances so isSpeaking resets everywhere
  _stopListeners.forEach(fn => fn());
}

// ---------------------------------------------------------------------------

export function useEdgeTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  // Track whether THIS instance is the active speaker so only it fires onEnd
  const ownerRef = useRef(false);

  // Register / deregister global-stop listener on mount / unmount
  useEffect(() => {
    const onGlobalStop = () => {
      if (ownerRef.current) {
        ownerRef.current = false;
        setIsSpeaking(false);
      }
    };
    _stopListeners.add(onGlobalStop);
    return () => {
      _stopListeners.delete(onGlobalStop);
      // If this instance was speaking when unmounted, relinquish ownership FIRST
      // so no post-unmount setIsSpeaking fires, then stop global audio.
      if (ownerRef.current) {
        ownerRef.current = false;
        globalStop();
      }
    };
  }, []);

  const stop = useCallback(() => {
    globalStop();
  }, []);

  const speak = useCallback(
    async (
      text: string,
      language = "English",
      onEnd?: () => void,
      options: EdgeSpeakOptions = {},
    ) => {
      if (!text.trim()) { onEnd?.(); return; }

      // Stop any currently-playing audio globally (resets all hook isSpeaking states)
      globalStop();

      ownerRef.current = true;
      setIsSpeaking(true);

      const gender: "male" | "female" =
        options.voiceGender === "male" ? "male" : "female";

      const ctrl = new AbortController();
      _abort = ctrl;

      try {
        const res = await fetch(`${BASE}/api/tts`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body:    JSON.stringify({ text: text.trim(), language, gender }),
          signal:  ctrl.signal,
        });

        if (!res.ok || ctrl.signal.aborted) {
          if (ownerRef.current) { ownerRef.current = false; setIsSpeaking(false); }
          onEnd?.();
          return;
        }

        const blob = await res.blob();
        if (ctrl.signal.aborted) {
          if (ownerRef.current) { ownerRef.current = false; setIsSpeaking(false); }
          onEnd?.();
          return;
        }

        const url = URL.createObjectURL(blob);
        _url = url;

        const audio = new Audio(url);
        _audio = audio;

        const rate = options.rate;
        if (rate && rate !== 1.0) audio.playbackRate = Math.max(0.8, Math.min(rate, 2.0));

        const cleanup = () => {
          // Only the owner fires onEnd — prevents double-fire if globally stopped
          if (ownerRef.current) {
            ownerRef.current = false;
            setIsSpeaking(false);
            onEnd?.();
          }
          URL.revokeObjectURL(url);
          if (_url === url)   _url   = null;
          if (_audio === audio) _audio = null;
        };

        audio.onended = cleanup;
        audio.onerror = cleanup;

        try {
          await audio.play();
        } catch {
          cleanup();
        }
      } catch (err: unknown) {
        if ((err as Error)?.name !== "AbortError") {
          if (ownerRef.current) { ownerRef.current = false; setIsSpeaking(false); }
          onEnd?.();
        }
      }
    },
    [],
  );

  return {
    isSpeaking,
    isSupported: true as const,
    speak,
    stop,
  };
}
