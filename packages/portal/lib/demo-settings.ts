import { getRedis } from "./redis";

/**
 * Demo-time safety settings, stored in Redis so admins can change them
 * without restarting the orchestrator/portal.
 */

const EMAIL_OVERRIDE_KEY = "demo:email_override";

export async function getEmailOverride(): Promise<string | null> {
  const r = getRedis();
  return await r.get(EMAIL_OVERRIDE_KEY);
}

export async function setEmailOverride(addr: string | null): Promise<void> {
  const r = getRedis();
  const trimmed = addr?.trim();
  if (!trimmed) {
    await r.del(EMAIL_OVERRIDE_KEY);
  } else {
    await r.set(EMAIL_OVERRIDE_KEY, trimmed);
  }
}
