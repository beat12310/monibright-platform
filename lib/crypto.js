import crypto from "crypto";

// Encrypts sensitive values before they are written to the database, so that a
// leaked database dump does not hand over every tenant's Paystack secret key.
//
// Format: "v1:<iv>:<authTag>:<ciphertext>", all base64.
// Anything without the "v1:" prefix is treated as a legacy plaintext value and
// returned unchanged, so existing rows keep working until they are re-saved.

const PREFIX = "v1:";

function key() {
  const raw = (process.env.ENCRYPTION_KEY || "").trim();
  if (!raw) {
    throw new Error("ENCRYPTION_KEY is not set. Add it in Vercel > Settings > Environment Variables, then redeploy.");
  }
  const buf = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex characters).");
  }
  return buf;
}

export function isEncrypted(value) {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

export function decryptSecret(stored) {
  if (!stored) return stored;
  if (!isEncrypted(stored)) return stored; // legacy plaintext row
  const [ivB64, tagB64, dataB64] = stored.slice(PREFIX.length).split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}
