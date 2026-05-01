import Redis from "ioredis";

let client: Redis | null = null;

export function getRedis(): Redis {
  if (client) return client;
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  client = new Redis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  });
  return client;
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
