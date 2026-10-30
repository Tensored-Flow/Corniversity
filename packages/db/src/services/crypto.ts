import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Symmetric encryption for the owner's stored provider key. AES-256-GCM with a key derived
 * from the auth secret; the stored format is base64(iv).base64(tag).base64(ciphertext).
 * Standard library primitives only; nothing here is a home-made cipher.
 */
function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(`corniversity:provider-key:${secret}`).digest();
}

export function encryptSecret(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${data.toString("base64")}`;
}

export function decryptSecret(payload: string, secret: string): string | undefined {
  const [iv, tag, data] = payload.split(".");
  if (!iv || !tag || !data) return undefined;
  try {
    const decipher = createDecipheriv("aes-256-gcm", deriveKey(secret), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return undefined;
  }
}

/** Shows only enough of a key for the owner to recognise it. */
export function keyHint(key: string): string {
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}
