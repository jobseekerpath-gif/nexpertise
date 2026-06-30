import { useEffect, useState } from "react";
import type { AvatarProps } from "./types";

const sizeClasses: Record<string, { container: string; image: string; ring: string; px: number }> = {
  sm: { container: "w-16 h-16", image: "w-16 h-16", ring: "w-16 h-16", px: 64 },
  md: { container: "w-24 h-24", image: "w-24 h-24", ring: "w-24 h-24", px: 96 },
  lg: { container: "w-32 h-32", image: "w-32 h-32", ring: "w-32 h-32", px: 128 },
  xl: { container: "w-40 h-40", image: "w-40 h-40", ring: "w-40 h-40", px: 160 },
};

/** Fallback cartoon SVG when no real image is available */
function FallbackSVG({
  gender,
  isSpeaking,
  isThinking,
  size,
}: {
  gender: "male" | "female";
  isSpeaking: boolean;
  isThinking: boolean;
  size: string;
}) {
  const [mouthOpen, setMouthOpen] = useState(false);
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    if (!isSpeaking) { setMouthOpen(false); return; }
    const id = setInterval(() => setMouthOpen(f => !f), 160);
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
  const sz = sizeClasses[size] ?? sizeClasses.md;

  return (
    <div className={`${sz.container} relative rounded-2xl overflow-hidden bg-gradient-to-b from-orange-50 via-white to-primary/10 border-2 border-primary/20`}>
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <defs>
          <radialGradient id="skin-fb" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#FFE1C2" />
            <stop offset="100%" stopColor="#E8AA78" />
          </radialGradient>
        </defs>
        <path d="M 38 195 Q 100 160 162 195 L 162 200 L 38 200 Z" fill="url(#skin-fb)" />
        <path d="M 82 158 L 100 178 L 118 158 L 100 154 Z" fill={accentColor} opacity="0.85" />
        <ellipse cx="100" cy="76" rx="79" ry="82" fill={hairColor} />
        <ellipse cx="100" cy="100" rx="70" ry="78" fill="url(#skin-fb)" />
        <path d={`M 24 78 Q 32 16 100 16 Q 168 16 176 78 Q 160 34 100 36 Q 40 34 24 78`} fill={hairColor} />
        <path d="M 61 74 Q 78 67 90 72" stroke={hairColor} strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M 110 72 Q 122 67 139 74" stroke={hairColor} strokeWidth="4" fill="none" strokeLinecap="round" />
        <ellipse cx="75" cy="90" rx="11" ry={blink ? 2 : 14} fill="#243043" />
        <ellipse cx="125" cy="90" rx="11" ry={blink ? 2 : 14} fill="#243043" />
        {!blink && <>
          <circle cx="79" cy="85" r="3.5" fill="white" />
          <circle cx="129" cy="85" r="3.5" fill="white" />
        </>}
        <path d="M 97 108 Q 100 116 103 108" stroke="#C68642" strokeWidth="2" fill="none" strokeLinecap="round" />
        <ellipse cx="65" cy="118" rx="14" ry="9" fill="#F4A261" opacity="0.18" />
        <ellipse cx="135" cy="118" rx="14" ry="9" fill="#F4A261" opacity="0.18" />
        <path
          d={mouthOpen ? "M 72 128 Q 100 146 128 128" : "M 72 128 Q 100 132 128 128"}
          stroke="#B91C1C" strokeWidth="3" fill="none" strokeLinecap="round"
        />
        {isThinking && (
          <g>
            {[80, 100, 120].map((cx, i) => (
              <circle key={cx} cx={cx} cy="170" r="5" fill={hairColor} opacity="0.7">
                <animate attributeName="opacity" values="0.7;0.2;0.7" dur="1.2s" repeatCount="indefinite" begin={`${i * 0.4}s`} />
              </circle>
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}

export function AnimatedAvatar({
  name,
  subtitle,
  isSpeaking,
  isThinking = false,
  gender = "female",
  size = "md",
  imageSrc,
}: AvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);

  // Reset failure state whenever the source changes so switching tutors works correctly
  useEffect(() => { setImgFailed(false); }, [imageSrc]);

  const sz = sizeClasses[size] ?? sizeClasses.md;
  const hasImage = imageSrc && !imgFailed;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        {hasImage ? (
          <div
            className={`${sz.container} rounded-2xl overflow-hidden shadow-lg relative`}
          >
            <img
              src={imageSrc}
              alt={name}
              width={sz.px}
              height={sz.px}
              className={`w-full h-full object-cover object-top transition-all duration-75 ${isSpeaking ? "brightness-105" : ""}`}
              onError={() => setImgFailed(true)}
              draggable={false}
            />
            {/* Lip-sync overlay — animated bars mimicking mouth movement when speaking */}
            {isSpeaking && (
              <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center gap-[3px] pb-2 px-3">
                {[5, 9, 12, 9, 7, 11, 8, 5].map((h, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-orange-400/90"
                    style={{
                      width: "3px",
                      height: `${h}px`,
                      animation: `lipBar 0.${3 + (i % 4)}s ease-in-out infinite alternate`,
                      animationDelay: `${i * 0.06}s`,
                    }}
                  />
                ))}
              </div>
            )}
            {/* Thinking indicator */}
            {isThinking && !isSpeaking && (
              <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-1.5">
                <span className="text-[8px] font-bold text-white bg-black/40 rounded-full px-2 py-0.5">
                  thinking…
                </span>
              </div>
            )}
          </div>
        ) : (
          <FallbackSVG
            gender={gender}
            isSpeaking={isSpeaking}
            isThinking={isThinking}
            size={size}
          />
        )}

        {/* AI badge */}
        <span className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground text-[9px] font-extrabold rounded-full px-1.5 py-0.5 leading-none shadow-md border border-white">
          AI
        </span>
      </div>

      <div className="text-center">
        <p className="text-xs font-bold text-secondary leading-tight">{name}</p>
        <p className="text-[10px] text-muted-foreground leading-tight">{subtitle}</p>
      </div>
    </div>
  );
}
