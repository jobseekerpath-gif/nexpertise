import { useEffect, useState } from "react";
import type { AvatarProps } from "./types";

const MOUTH_FRAMES = [
  "M 72 128 Q 100 132 128 128",
  "M 72 128 Q 100 142 128 128",
  "M 72 128 Q 100 150 128 128",
  "M 72 128 Q 100 142 128 128",
];

export function AnimatedAvatar({ name, role, isSpeaking, isThinking, gender = "female", size = "md" }: AvatarProps) {
  const [mouthFrame, setMouthFrame] = useState(0);
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    if (!isSpeaking) { setMouthFrame(0); return; }
    const id = setInterval(() => setMouthFrame(f => (f + 1) % MOUTH_FRAMES.length), 140);
    return () => clearInterval(id);
  }, [isSpeaking]);

  useEffect(() => {
    const id = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 140);
    }, 3500 + Math.random() * 1500);
    return () => clearInterval(id);
  }, []);

  const hairColor = gender === "female" ? "#6B3FA0" : "#4A2C0A";
  const skinColor = "#FDDBB4";
  const eyeHeight = blink ? 2 : 14;

  const sizeClasses: Record<string, string> = {
    sm: "w-16 h-16",
    md: "w-24 h-24",
    lg: "w-32 h-32",
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`${sizeClasses[size] ?? sizeClasses.md} relative rounded-full overflow-hidden bg-gradient-to-b from-indigo-100 to-purple-100 shadow-lg border-2 border-primary/20`}>
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <defs>
            <radialGradient id="skin" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#FDDBB4" />
              <stop offset="100%" stopColor="#E8A87C" />
            </radialGradient>
          </defs>
          {/* Hair back */}
          <ellipse cx="100" cy="75" rx="80" ry="85" fill={hairColor} />
          {/* Neck */}
          <rect x="83" y="165" width="34" height="35" rx="8" fill="url(#skin)" />
          {/* Head */}
          <ellipse cx="100" cy="100" rx="72" ry="80" fill="url(#skin)" />
          {/* Hair front */}
          <path d={`M 28 75 Q 30 20 100 18 Q 170 20 172 75 Q 160 35 100 35 Q 40 35 28 75`} fill={hairColor} />
          {gender === "female" && (
            <path d="M 28 75 Q 22 100 28 130 Q 20 95 28 75" fill={hairColor} />
          )}
          {/* Eyebrows */}
          <path d="M 62 75 Q 78 69 88 73" stroke={hairColor} strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path d="M 112 73 Q 122 69 138 75" stroke={hairColor} strokeWidth="3.5" fill="none" strokeLinecap="round" />
          {/* Eyes */}
          <ellipse cx="75" cy="90" rx="11" ry={eyeHeight} fill="#2D2D2D" />
          <ellipse cx="125" cy="90" rx="11" ry={eyeHeight} fill="#2D2D2D" />
          {/* Eye highlights */}
          {!blink && <>
            <circle cx="79" cy="85" r="3.5" fill="white" />
            <circle cx="129" cy="85" r="3.5" fill="white" />
          </>}
          {/* Nose */}
          <path d="M 97 108 Q 100 116 103 108" stroke="#C68642" strokeWidth="2" fill="none" strokeLinecap="round" />
          {/* Cheeks */}
          <ellipse cx="65" cy="118" rx="14" ry="9" fill="#F4A261" opacity="0.25" />
          <ellipse cx="135" cy="118" rx="14" ry="9" fill="#F4A261" opacity="0.25" />
          {/* Mouth */}
          <path d={MOUTH_FRAMES[mouthFrame]} stroke="#C0392B" strokeWidth="3" fill="none" strokeLinecap="round" />
          {/* Lips */}
          <path d={`M 72 128 Q 100 ${isSpeaking ? "124" : "126"} 128 128`} stroke="#E07070" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          {/* Thinking dots */}
          {isThinking && (
            <g>
              <circle cx="80" cy="170" r="5" fill={hairColor} opacity="0.7">
                <animate attributeName="opacity" values="0.7;0.2;0.7" dur="1.2s" repeatCount="indefinite" begin="0s" />
              </circle>
              <circle cx="100" cy="170" r="5" fill={hairColor} opacity="0.7">
                <animate attributeName="opacity" values="0.7;0.2;0.7" dur="1.2s" repeatCount="indefinite" begin="0.4s" />
              </circle>
              <circle cx="120" cy="170" r="5" fill={hairColor} opacity="0.7">
                <animate attributeName="opacity" values="0.7;0.2;0.7" dur="1.2s" repeatCount="indefinite" begin="0.8s" />
              </circle>
            </g>
          )}
        </svg>
        {isSpeaking && (
          <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-0.5 pb-1">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="w-1 bg-primary rounded-full animate-pulse"
                style={{ height: `${6 + (i % 2) * 4}px`, animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        )}
      </div>
      <div className="text-center">
        <p className="text-xs font-bold text-secondary">{name}</p>
        <p className="text-[10px] text-muted-foreground">{role}</p>
      </div>
    </div>
  );
}
