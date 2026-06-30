import AsyncStorage from '@react-native-async-storage/async-storage';

export type Profile = {
  name: string;
  age: string;
  education: string;
  careerGoal: string;
  skills: string;
  language: string;
  location: string;
  salaryExpectation: string;
};

export const defaultProfile: Profile = {
  name: '',
  age: '',
  education: 'Graduate',
  careerGoal: 'IT / Tech',
  skills: '',
  language: 'English',
  location: 'Delhi',
  salaryExpectation: '₹3-5 LPA',
};

export async function getProfile(): Promise<Profile> {
  try {
    const raw = await AsyncStorage.getItem('edubharat_profile');
    return raw ? { ...defaultProfile, ...(JSON.parse(raw) as Partial<Profile>) } : defaultProfile;
  } catch {
    return defaultProfile;
  }
}

export async function saveProfile(profile: Profile): Promise<void> {
  await AsyncStorage.setItem('edubharat_profile', JSON.stringify(profile));
}

export type Progress = {
  englishMinutes: number;
  interviewCount: number;
  resumeAnalyses: number;
  jobsSaved: number;
  streakDays: number;
};

export const defaultProgress: Progress = {
  englishMinutes: 0,
  interviewCount: 0,
  resumeAnalyses: 0,
  jobsSaved: 0,
  streakDays: 1,
};

export async function getProgress(): Promise<Progress> {
  try {
    const raw = await AsyncStorage.getItem('edubharat_progress');
    return raw ? { ...defaultProgress, ...(JSON.parse(raw) as Partial<Progress>) } : defaultProgress;
  } catch {
    return defaultProgress;
  }
}

export async function saveProgress(progress: Progress): Promise<void> {
  await AsyncStorage.setItem('edubharat_progress', JSON.stringify(progress));
}

export async function incrementProgress(key: keyof Progress): Promise<void> {
  const current = await getProgress();
  current[key] = (current[key] as number) + 1;
  await saveProgress(current);
}

// ─── Saved Jobs ───────────────────────────────────────────────────────────────

export type SavedJob = {
  title: string;
  link: string;
  source: string;
  publishedAt: string | null;
  summary: string;
  company?: string;
  location?: string;
  jobType?: string;
  remote?: boolean;
  salary?: string;
  kind?: string;
  savedAt: string; // ISO timestamp
};

const SAVED_JOBS_KEY = 'edubharat_saved_jobs';

export async function getSavedJobs(): Promise<SavedJob[]> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_JOBS_KEY);
    return raw ? (JSON.parse(raw) as SavedJob[]) : [];
  } catch {
    return [];
  }
}

export async function toggleSavedJob(job: Omit<SavedJob, 'savedAt'>): Promise<{ saved: boolean; count: number }> {
  const current = await getSavedJobs();
  const idx = current.findIndex((j) => j.link === job.link);
  let saved: boolean;
  if (idx >= 0) {
    current.splice(idx, 1);
    saved = false;
  } else {
    current.unshift({ ...job, savedAt: new Date().toISOString() });
    saved = true;
  }
  await AsyncStorage.setItem(SAVED_JOBS_KEY, JSON.stringify(current));
  // Keep jobsSaved counter in sync
  const progress = await getProgress();
  progress.jobsSaved = current.length;
  await saveProgress(progress);
  return { saved, count: current.length };
}
