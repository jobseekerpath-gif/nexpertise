export { AnimatedAvatar } from "./animated-avatar";
export type { AvatarProps, AvatarProviderConfig } from "./types";

export function getAvatarProvider() {
  if (typeof window !== "undefined") {
    if ((window as unknown as Record<string, string>).__HEYGEN_API_KEY) return "heygen";
    if ((window as unknown as Record<string, string>).__DID_API_KEY) return "did";
  }
  return "css";
}
