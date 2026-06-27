import { useCallback, useEffect, useState, useRef } from "react";
import { useAuth } from "./use-auth";

export type VoiceGender = "male" | "female";
export type VoiceStyle = "priya" | "neerja" | "meera" | "rohit" | "arjun" | "rahul";

export type StudentProfile = {
  name: string;
  preferredLanguage: string;
  voiceGender: VoiceGender;
  voiceStyle: VoiceStyle;
  // Extended fields
  gender: string;
  degree: string;
  branch: string;
  graduationYear: string;
  university: string;
  skills: string[];
  careerGoal: string;
  preferredRole: string;
  industryPreference: string;
  preferredCity: string;
  location: string;
  expectedSalary: string;
  experienceLevel: string;
  englishLevel: string;
  preferredInterviewer: string;
  preferredTutor: string;
};

const STORAGE_KEY = "edubharat_student_profile";
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const DEFAULT_PROFILE: StudentProfile = {
  name: "",
  preferredLanguage: "English",
  voiceGender: "female",
  voiceStyle: "priya",
  gender: "",
  degree: "",
  branch: "",
  graduationYear: "",
  university: "",
  skills: [],
  careerGoal: "",
  preferredRole: "",
  industryPreference: "",
  preferredCity: "",
  location: "",
  expectedSalary: "",
  experienceLevel: "Fresher",
  englishLevel: "Beginner",
  preferredInterviewer: "raj",
  preferredTutor: "priya",
};

function normalizeVoiceStyle(style: unknown, gender: VoiceGender): VoiceStyle {
  if (style === "priya" || style === "neerja" || style === "meera" || style === "rohit" || style === "arjun" || style === "rahul") return style;
  if (style === "ravi") return "rohit";
  return gender === "male" ? "rohit" : "priya";
}

function fromApiUser(user: Record<string, unknown>): StudentProfile {
  const voiceGender: VoiceGender = user["voiceGender"] === "male" ? "male" : "female";
  let skills: string[] = [];
  if (Array.isArray(user["skills"])) skills = user["skills"] as string[];
  else if (typeof user["skills"] === "string") {
    try { skills = JSON.parse(user["skills"]) as string[]; } catch { skills = []; }
  }
  return {
    name: typeof user["name"] === "string" ? user["name"] : "",
    preferredLanguage: typeof user["preferredLanguage"] === "string" ? user["preferredLanguage"] : "English",
    voiceGender,
    voiceStyle: normalizeVoiceStyle(user["voiceStyle"], voiceGender),
    gender: typeof user["gender"] === "string" ? user["gender"] : "",
    degree: typeof user["degree"] === "string" ? user["degree"] : "",
    branch: typeof user["branch"] === "string" ? user["branch"] : "",
    graduationYear: typeof user["graduationYear"] === "string" ? user["graduationYear"] : "",
    university: typeof user["university"] === "string" ? user["university"] : "",
    skills,
    careerGoal: typeof user["careerGoal"] === "string" ? user["careerGoal"] : "",
    preferredRole: typeof user["preferredRole"] === "string" ? user["preferredRole"] : "",
    industryPreference: typeof user["industryPreference"] === "string" ? user["industryPreference"] : "",
    preferredCity: typeof user["preferredCity"] === "string" ? user["preferredCity"] : "",
    location: typeof user["location"] === "string" ? user["location"] : "",
    expectedSalary: typeof user["expectedSalary"] === "string" ? user["expectedSalary"] : "",
    experienceLevel: typeof user["experienceLevel"] === "string" ? user["experienceLevel"] : "Fresher",
    englishLevel: typeof user["englishLevel"] === "string" ? user["englishLevel"] : "Beginner",
    preferredInterviewer: typeof user["preferredInterviewer"] === "string" ? user["preferredInterviewer"] : "raj",
    preferredTutor: typeof user["preferredTutor"] === "string" ? user["preferredTutor"] : "priya",
  };
}

function loadLocalProfile(): StudentProfile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const voiceGender: VoiceGender = parsed["voiceGender"] === "male" ? "male" : "female";
    let skills: string[] = [];
    if (Array.isArray(parsed["skills"])) skills = parsed["skills"] as string[];
    return {
      name: typeof parsed["name"] === "string" ? parsed["name"] : DEFAULT_PROFILE.name,
      preferredLanguage: typeof parsed["preferredLanguage"] === "string" ? parsed["preferredLanguage"] : DEFAULT_PROFILE.preferredLanguage,
      voiceGender,
      voiceStyle: normalizeVoiceStyle(parsed["voiceStyle"], voiceGender),
      gender: typeof parsed["gender"] === "string" ? parsed["gender"] : "",
      degree: typeof parsed["degree"] === "string" ? parsed["degree"] : "",
      branch: typeof parsed["branch"] === "string" ? parsed["branch"] : "",
      graduationYear: typeof parsed["graduationYear"] === "string" ? parsed["graduationYear"] : "",
      university: typeof parsed["university"] === "string" ? parsed["university"] : "",
      skills,
      careerGoal: typeof parsed["careerGoal"] === "string" ? parsed["careerGoal"] : "",
      preferredRole: typeof parsed["preferredRole"] === "string" ? parsed["preferredRole"] : "",
      industryPreference: typeof parsed["industryPreference"] === "string" ? parsed["industryPreference"] : "",
      preferredCity: typeof parsed["preferredCity"] === "string" ? parsed["preferredCity"] : "",
      location: typeof parsed["location"] === "string" ? parsed["location"] : "",
      expectedSalary: typeof parsed["expectedSalary"] === "string" ? parsed["expectedSalary"] : "",
      experienceLevel: typeof parsed["experienceLevel"] === "string" ? parsed["experienceLevel"] : "Fresher",
      englishLevel: typeof parsed["englishLevel"] === "string" ? parsed["englishLevel"] : "Beginner",
      preferredInterviewer: typeof parsed["preferredInterviewer"] === "string" ? parsed["preferredInterviewer"] : "raj",
      preferredTutor: typeof parsed["preferredTutor"] === "string" ? parsed["preferredTutor"] : "priya",
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

function saveLocalProfile(p: StudentProfile) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

export function useStudentProfile() {
  const { user } = useAuth();
  const [profile, setProfileState] = useState<StudentProfile>(loadLocalProfile);
  const [isLoading, setIsLoading] = useState(false);
  const syncedRef = useRef(false);

  // When user logs in, fetch profile from server and merge
  useEffect(() => {
    if (!user || syncedRef.current) return;
    syncedRef.current = true;
    setIsLoading(true);
    fetch(`${BASE}/api/profile`, { credentials: "include" })
      .then(r => r.json())
      .then((data: { profile?: Record<string, unknown> }) => {
        if (data.profile) {
          const serverProfile = fromApiUser(data.profile);
          setProfileState(serverProfile);
          saveLocalProfile(serverProfile);
        }
      })
      .catch(() => { /* keep local */ })
      .finally(() => setIsLoading(false));
  }, [user]);

  // Reset sync flag on logout
  useEffect(() => {
    if (!user) { syncedRef.current = false; }
  }, [user]);

  const updateProfile = useCallback(async (patch: Partial<StudentProfile>) => {
    setProfileState(current => {
      const updated = { ...current, ...patch };
      saveLocalProfile(updated);
      return updated;
    });

    // If logged in, persist to server — throw on failure so callers can surface errors
    if (user) {
      const res = await fetch(`${BASE}/api/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Server error ${res.status}`);
      }
    }
  }, [user]);

  // Compute profile completion percentage
  const completionFields: (keyof StudentProfile)[] = [
    "name", "gender", "degree", "careerGoal", "preferredRole",
    "preferredCity", "englishLevel", "experienceLevel", "skills",
  ];
  const filled = completionFields.filter(f => {
    const v = profile[f];
    return Array.isArray(v) ? v.length > 0 : Boolean(v);
  }).length;
  const completionPct = Math.round((filled / completionFields.length) * 100);

  return { profile, updateProfile, isLoading, completionPct };
}
