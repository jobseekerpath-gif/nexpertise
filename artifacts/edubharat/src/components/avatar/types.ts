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
  size?: "sm" | "md" | "lg";
  providerConfig?: AvatarProviderConfig;
}
