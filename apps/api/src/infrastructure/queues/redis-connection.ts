import IORedis from 'ioredis';

/**
 * BullMQ requires `maxRetriesPerRequest: null` on its Redis connections
 * for blocking commands (used by Workers/QueueEvents) to work
 * correctly — this is a hard BullMQ requirement, not a style choice.
 * Each BullMQ construct (Queue, Worker, QueueEvents) should get its own
 * connection rather than sharing one instance.
 */
export function createRedisConnection(redisUrl: string): IORedis {
  return new IORedis(redisUrl, { maxRetriesPerRequest: null });
}
