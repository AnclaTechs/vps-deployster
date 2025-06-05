const Redis = require("ioredis");
const REDIS_DEPLOYSTER_PORT = process.env.REDIS_DEPLOYSTER_PORT || 6379;
const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_URL = process.env.REDIS_URL;

let redisClient;

if (REDIS_URL) {
  redisClient = new Redis(REDIS_URL);
} else {
  redisClient = new Redis({
    port: REDIS_DEPLOYSTER_PORT,
    host: REDIS_HOST,
  });
}

module.exports = redisClient;
