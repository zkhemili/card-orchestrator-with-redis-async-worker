import { Queue } from "bullmq";

export function createQueue(env, redis) {
  return new Queue(env.QUEUE_NAME, { connection: redis });
}