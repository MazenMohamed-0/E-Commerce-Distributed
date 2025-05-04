// Mock Redis client for debugging
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'debug-redis.log' })
  ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

class DebugRedisClient {
  constructor() {
    this.connected = true;
    this.DEFAULT_TTL = 600; // Not actually used
    logger.info('Debug Redis client created - NO ACTUAL CACHING WILL OCCUR');
  }

  connect() {
    return Promise.resolve(this);
  }

  // Just return the data without caching
  async get(key) {
    logger.info(`DEBUG: Skipping cache lookup for key: ${key}`);
    return null; // Always return null to force a cache miss
  }

  // Just log the data without caching
  async set(key, value, ttl = this.DEFAULT_TTL) {
    logger.info(`DEBUG: Skipping cache storage for key: ${key}`);
    return true;
  }

  async delete(key) {
    logger.info(`DEBUG: Skipping cache deletion for key: ${key}`);
    return true;
  }

  async deletePattern(pattern) {
    logger.info(`DEBUG: Skipping pattern deletion for: ${pattern}`);
    return true;
  }

  async clear() {
    logger.info('DEBUG: Skipping cache clear');
    return true;
  }

  disconnect() {
    logger.info('DEBUG: Skipping disconnect');
  }
}

// Export singleton
const debugRedisClient = new DebugRedisClient();
module.exports = debugRedisClient; 