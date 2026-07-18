import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

const TOKEN_TTL_SECONDS = 60 * 60 * 4; // 4 hours

function b64u(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function b64uDecode(s: string): Buffer {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
}

function secret(): string {
  const s = process.env.GALLERY_TOKEN_SECRET;
  if (!s) throw new Error("GALLERY_TOKEN_SECRET is not set");
  return s;
}

export interface GalleryTokenPayload {
  gid: string;
  exp: number;
}

export function signGalleryToken(galleryId: string, ttlSeconds: number = TOKEN_TTL_SECONDS): string {
  const payload: GalleryTokenPayload = {
    gid: galleryId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = b64u(JSON.stringify(payload));
  const sig = b64u(createHmac("sha256", secret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyGalleryToken(token: string): GalleryTokenPayload | null {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const expected = createHmac("sha256", secret()).update(body).digest();
    const provided = b64uDecode(sig);
    if (provided.length !== expected.length) return null;
    if (!timingSafeEqual(provided, expected)) return null;
    const payload = JSON.parse(b64uDecode(body).toString("utf8")) as GalleryTokenPayload;
    if (!payload.gid || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function newSecretUrl(): string {
  // 128-bit random, hex — opaque, unguessable.
  return randomBytes(16).toString("hex") + "-" + randomBytes(8).toString("hex");
}

export function suggestPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}