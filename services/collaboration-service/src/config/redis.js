const redis = require('redis');

let redisClient = null;
let redisPub = null;
let redisSub = null;

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;

async function initializeRedis() {
  try {
    // Main Redis client
    redisClient = redis.createClient({
      socket: {
        host: REDIS_HOST,
        port: REDIS_PORT
      }
    });

    // Publisher client for Pub/Sub
    redisPub = redis.createClient({
      socket: {
        host: REDIS_HOST,
        port: REDIS_PORT
      }
    });

    // Subscriber client for Pub/Sub
    redisSub = redis.createClient({
      socket: {
        host: REDIS_HOST,
        port: REDIS_PORT
      }
    });

    redisClient.on('error', (err) => console.error('Redis Client Error:', err));
    redisPub.on('error', (err) => console.error('Redis Pub Error:', err));
    redisSub.on('error', (err) => console.error('Redis Sub Error:', err));

    await redisClient.connect();
    await redisPub.connect();
    await redisSub.connect();

    console.log('Redis clients connected successfully');
  } catch (error) {
    console.error('Failed to initialize Redis:', error);
    throw error;
  }
}

function getRedisClient() {
  return redisClient;
}

function getRedisPub() {
  return redisPub;
}

function getRedisSub() {
  return redisSub;
}

module.exports = {
  initializeRedis,
  getRedisClient,
  getRedisPub,
  getRedisSub
};