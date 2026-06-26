import { useEffect, useState } from "react";
import type { AvatarProps } from "./types";

const MOUTH_FRAMES = [
  "M 72 128 Q 100 132 128 128",
  "M 72 128 Q 100 140 128 128",
  "M 72 128 Q 100 146 128 128",
  "M 72 128 Q 100 140 128 128",
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

  const hairColor = gender === "female" ? "#7A4BCB" : "#3F2510";
  const accentColor = gender === "female" ? "#F472B6" : "#60A5FA";
  const eyeHeight = blink ? 2 : 14;

  const sizeClasses: Record<string, string> = {
    sm: "w-16 h-16",
    md: "w-24 h-24",
    lg: "w-32 h-32",
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`${sizeClasses[size] ?? sizeClasses.md} relative rounded-full overflow-hidden bg-gradient-to-b from-orange-50 via-white to-primary/10 shadow-lg border-2 border-primary/20`}>
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <defs>
            <radialGradient id="skin" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#FFE1C2" />
              <stop offset="100%" stopColor="#E8AA78" />
            </radialGradient>
            <linearGradient id="shirt" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFF7ED" />
              <stop offset="100%" stopColor="#FFE4C7" />
            </linearGradient>
          </defs>
          {/* Shirt / collar */}
          <path d="M 38 195 Q 100 160 162 195 L 162 200 L 38 200 Z" fill="url(#shirt)" />
          <path d="M 82 158 L 100 178 L 118 158 L 100 154 Z" fill={accentColor} opacity="0.85" />
          {/* Hair back */}
          <ellipse cx="100" cy="76" rx="79" ry="82" fill={hairColor} />
          {/* Head */}
          <ellipse cx="100" cy="100" rx="70" ry="78" fill="url(#skin)" />
          {/* Hair front */}
          <path d={`M 24 78 Q 32 16 100 16 Q 168 16 176 78 Q 160 34 100 36 Q 40 34 24 78`} fill={hairColor} />
          {gender === "female" && (
            <path d="M 26 76 Q 18 108 28 138 Q 14 102 26 76" fill={hairColor} />
          )}
          {gender === "male" && (
            <path d="M 174 76 Q 182 108 172 138 Q 186 102 174 76" fill={hairColor} />
          )}
          {/* Eyebrows */}
          <path d="M 61 74 Q 78 67 90 72" stroke={hairColor} strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M 110 72 Q 122 67 139 74" stroke={hairColor} strokeWidth="4" fill="none" strokeLinecap="round" />
          {/* Eyes */}
          <ellipse cx="75" cy="90" rx="11" ry={eyeHeight} fill="#243043" />
          <ellipse cx="125" cy="90" rx="11" ry={eyeHeight} fill="#243043" />
          {/* Eye highlights */}
          {!blink && <>
            <circle cx="79" cy="85" r="3.5" fill="white" />
            <circle cx="129" cy="85" r="3.5" fill="white" />
          </>}
          {/* Nose */}
          <path d="M 97 108 Q 100 116 103 108" stroke="#C68642" strokeWidth="2" fill="none" strokeLinecap="round" />
          {/* Cheeks */}
          <ellipse cx="65" cy="118" rx="14" ry="9" fill="#F4A261" opacity="0.18" />
          <ellipse cx="135" cy="118" rx="14" ry="9" fill="#F4A261" opacity="0.18" />
          {/* Mouth */}
          <path d={MOUTH_FRAMES[mouthFrame]} stroke="#B91C1C" strokeWidth="3" fill="none" strokeLinecap="round" />
          {/* Lips */}
          <path d={`M 72 128 Q 100 ${isSpeaking ? "124" : "126"} 128 128`} stroke="#F59E9E" strokeWidth="1.5" fill="none" strokeLinecap="round" />
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
