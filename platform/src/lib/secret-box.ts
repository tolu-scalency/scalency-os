import "server-only";
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";

// Encrypts small secrets (mailbox passwords) before they're stored, with AES-256-GCM.
// The key comes from EMAIL_SECRET_KEY in Netlify. If that isn't set, it's derived from
// SUPABASE_SECRET_KEY, so nothing extra is needed to start. Changing either key means
// workspaces have to reconnect their mailbox.

function key(): Buffer {
  const own = process.env.EMAIL_SECRET_KEY;
  if (own && own.length >= 32) return createHash("sha256").update(own).digest();
  const base = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) throw new Error("Set EMAIL_SECRET_KEY or SUPABASE_SECRET_KEY in Netlify first.");
  return Buffer.from(hkdfSync("sha256", base, "scalency-os", "email-sender-secret-v1", 32));
}

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), body.toString("base64")].join(".");
}

export function open(sealed: string): string {
  const [v, iv, tag, body] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !body) throw new Error("This saved password can't be read. Reconnect the mailbox.");
  try {
    const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(body, "base64")), d.final()]).toString("utf8");
  } catch {
    throw new Error("This saved password can't be read (the server key changed). Reconnect the mailbox.");
  }
}
