import { getRedis } from "./redis";

const EMAIL_OVERRIDE_KEY = "demo:email_override";

export async function getEmailOverride(): Promise<string | null> {
  const r = getRedis();
  return await r.get(EMAIL_OVERRIDE_KEY);
}
