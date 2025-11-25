const IORedis = require("ioredis");

const { createClient } = require("redis");

const REDIS_PORT = process.env.DEPLOYSTER_REDIS_PORT || 6379;
const REDIS_HOST = process.env.DEPLOYSTER_REDIS_HOST || "localhost";
const REDIS_URL = process.env.DEPLOYSTER_REDIS_URL;

let ioRedisClient;

if (REDIS_URL) {
  ioRedisClient = new IORedis(REDIS_URL);
} else {
  ioRedisClient = new IORedis({
    port: REDIS_PORT,
    host: REDIS_HOST,
  });
}

//
let redisClient = createClient({
  url: REDIS_URL || `redis://${REDIS_HOST}:${REDIS_PORT}`,
});

redisClient.connect().catch(console.error);

module.exports = {
  ioRedisClient,
  redisClient,
};
