import { Queue } from "bullmq";
import { Redis as IORedis } from "ioredis";

export const redisConnection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export interface DispatchJobData {
  notificationId: string;
}

export interface ExpiryJobData {
  notificationId: string;
}

export const dispatchQueue = new Queue<DispatchJobData>("notification-dispatch", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 500,
    removeOnFail: 200,
  },
});

export const expiryQueue = new Queue<ExpiryJobData>("notification-expiry", {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 200,
    removeOnFail: 100,
  },
});
