import { randomBytes } from "node:crypto";

type ServerEnv = {
  appUrl: string;
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  encryptionKey: string;
  sessionSecret: string;
  storageDir: string;
};

function withFallbackSecret(value: string | undefined, bytes: number) {
  if (value) return value;
  return randomBytes(bytes).toString("base64");
}

const appUrl = process.env.APP_URL ?? "http://localhost:3000";

export function getServerEnv(): ServerEnv {
  return {
    appUrl,
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    googleRedirectUri:
      process.env.GOOGLE_REDIRECT_URI ?? `${appUrl}/api/auth/google/callback`,
    encryptionKey: withFallbackSecret(process.env.KLAR_ENCRYPTION_KEY, 32),
    sessionSecret: withFallbackSecret(process.env.KLAR_SESSION_SECRET, 32),
    storageDir: process.env.KLAR_STORAGE_DIR ?? ".klar-data"
  };
}

export function hasGoogleOAuthConfig() {
  const env = getServerEnv();
  return Boolean(env.googleClientId && env.googleClientSecret);
}
