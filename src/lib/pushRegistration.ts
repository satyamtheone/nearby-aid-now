let registeredFcmToken: string | null = null;

export const rememberFcmToken = (token: string) => {
  registeredFcmToken = token;
};

export const takeFcmToken = () => {
  const token = registeredFcmToken;
  registeredFcmToken = null;
  return token;
};
