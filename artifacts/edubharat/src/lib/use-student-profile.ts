import { useCallback, useEffect, useState } from "react";

export type VoiceGender = "male" | "female";
export type VoiceStyle = "priya" | "neerja" | "meera" | "rohit" | "arjun" | "rahul";

export type StudentProfile = {
  name: string;
  preferredLanguage: string;
  voiceGender: VoiceGender;
  voiceStyle: VoiceStyle;
};

const STORAGE_KEY = "edubharat_student_profile";

const DEFAULT_PROFILE: StudentProfile = {
  name: "",
  preferredLanguage: "English",
  voiceGender: "female",
  voiceStyle: "priya",
};

function normalizeVoiceStyle(style: unknown, gender: VoiceGender): VoiceStyle {
  if (style === "priya" || style === "neerja" || style === "meera" || style === "rohit" || style === "arjun" || style === "rahul") {
    return style;
  }
  if (style === "ravi") return "rohit";
  return gender === "male" ? "rohit" : "priya";
}

function loadProfile(): StudentProfile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as { name?: unknown; preferredLanguage?: unknown; voiceGender?: unknown; voiceStyle?: unknown };
    const voiceGender: VoiceGender = parsed.voiceGender === "male" ? "male" : "female";
    return {
      name: typeof parsed.name === "string" ? parsed.name : DEFAULT_PROFILE.name,
      preferredLanguage: typeof parsed.preferredLanguage === "string" ? parsed.preferredLanguage : DEFAULT_PROFILE.preferredLanguage,
      voiceGender,
      voiceStyle: normalizeVoiceStyle(parsed.voiceStyle, voiceGender),
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function useStudentProfile() {
  const [profile, setProfile] = useState<StudentProfile>(loadProfile);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }, [profile]);

  const updateProfile = useCallback((patch: Partial<StudentProfile>) => {
    setProfile((current) => ({ ...current, ...patch }));
  }, []);

  return {
    profile,
    setProfile,
    updateProfile,
  };
}