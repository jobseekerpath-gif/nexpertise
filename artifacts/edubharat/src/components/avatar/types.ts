export interface AvatarProviderConfig {
  provider: "css" | "heygen" | "did" | "synthesia";
  avatarId?: string;
  apiKey?: string;
}

export interface AvatarProps {
  name: string;
  role: string;
  isSpeaking: boolean;
  isThinking?: boolean;
  gender?: "male" | "female";
  size?: "sm" | "md" | "lg" | "xl";
  imageSrc?: string;
  providerConfig?: AvatarProviderConfig;
}

export interface TutorPersona {
  id: string;
  name: string;
  title: string;
  role: string;
  gender: "male" | "female";
  voiceStyle: string;
  voiceGender: "male" | "female";
  specialization: string;
  teachingStyle: string;
  languages: string[];
  accent: string;
  intro: string;
  imageSrc: string;
  accentColor: string;
}
