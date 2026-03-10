import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

type EncryptedPayload = {
  iv: string;
  tag: string;
  value: string;
};

function toKey(secret: string) {
  return createHash("sha256").update(secret).digest();
}

export function encryptJson<T>(secret: string, payload: T): EncryptedPayload {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", toKey(secret), iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    value: encrypted.toString("base64")
  };
}

export function decryptJson<T>(secret: string, payload: EncryptedPayload): T {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    toKey(secret),
    Buffer.from(payload.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.value, "base64")),
    decipher.final()
  ]);

  return JSON.parse(decrypted.toString("utf8")) as T;
}
