import { Redis } from "ioredis";

let subscriber: Redis | null = null;

export function getSubscriber(): Redis {
  if (subscriber) return subscriber;
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  subscriber = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: false });
  return subscriber;
}
