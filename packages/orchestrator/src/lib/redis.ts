import { Redis } from "ioredis";

let client: Redis | null = null;
let subscriber: Redis | null = null;

export function getRedis(): Redis {
  if (client) return client;
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  client = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: false });
  return client;
}

export function getSubscriber(): Redis {
  if (subscriber) return subscriber;
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  subscriber = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: false });
  return subscriber;
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
  if (subscriber) {
    await subscriber.quit();
    subscriber = null;
  }
}
