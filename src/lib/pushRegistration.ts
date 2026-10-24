export type PushPlatform = "android" | "web";

const registeredFcmTokens = new Map<PushPlatform, string>();

export const rememberFcmToken = (token: string, platform: PushPlatform = "android") => {
  registeredFcmTokens.set(platform, token);
};

export const takeFcmToken = (platform: PushPlatform = "android") => {
  const token = registeredFcmTokens.get(platform) ?? null;
  registeredFcmTokens.delete(platform);
  return token;
};
