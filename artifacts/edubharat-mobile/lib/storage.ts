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
