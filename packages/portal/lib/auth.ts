import crypto from "crypto";
import { cookies } from "next/headers";

export interface Session {
  username: string;
  name: string;
  iat: number;
}

export interface AuthUser {
  username: string;
  password: string;
  name: string;
}

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export const SESSION_COOKIE = "hr_session";

function getSecret(): string {
  const s = process.env.AUTH_SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SESSION_SECRET missing or too short");
  return s;
}

function getUsers(): AuthUser[] {
  const raw = process.env.AUTH_USERS ?? "[]";
  return JSON.parse(raw);
}

function b64u(buf: Buffer): string {
  return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64uDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad), "base64");
}

export function signSession(data: Omit<Session, "iat">): string {
  const session: Session = { ...data, iat: Date.now() };
  const payload = b64u(Buffer.from(JSON.stringify(session)));
  const sig = b64u(crypto.createHmac("sha256", getSecret()).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifySession(token: string): Session | null {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    const expected = b64u(crypto.createHmac("sha256", getSecret()).update(payload).digest());
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return null;
    if (!crypto.timingSafeEqual(a, b)) return null;
    const session = JSON.parse(b64uDecode(payload).toString("utf-8")) as Session;
    if (Date.now() - session.iat > SESSION_TTL_MS) return null;
    return session;
  } catch {
    return null;
  }
}

export function validateCredentials(username: string, password: string): AuthUser | null {
  const u = getUsers().find((u) => u.username === username && u.password === password);
  return u ?? null;
}

export async function getCurrentUser(): Promise<Session | null> {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}
