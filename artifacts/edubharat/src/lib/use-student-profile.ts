import { useCallback, useEffect, useState } from "react";

export type VoiceGender = "male" | "female";

export type StudentProfile = {
  name: string;
  preferredLanguage: string;
  voiceGender: VoiceGender;
};

const STORAGE_KEY = "edubharat_student_profile";

const DEFAULT_PROFILE: StudentProfile = {
  name: "",
  preferredLanguage: "English",
  voiceGender: "female",
};

function loadProfile(): StudentProfile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as Partial<StudentProfile>;
    return {
      name: typeof parsed.name === "string" ? parsed.name : DEFAULT_PROFILE.name,
      preferredLanguage: typeof parsed.preferredLanguage === "string" ? parsed.preferredLanguage : DEFAULT_PROFILE.preferredLanguage,
      voiceGender: parsed.voiceGender === "male" ? "male" : "female",
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