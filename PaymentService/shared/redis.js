// Debug Redis client - with MongoDB document handling
// No actual Redis dependency needed

class DebugRedisClient {
  constructor() {
    this.connected = true;
    this.DEFAULT_TTL = 600; // Not actually used
    console.log('Debug Redis client created - NO ACTUAL CACHING WILL OCCUR');
  }

  connect() {
    console.log('Debug Redis connect called');
    return Promise.resolve(this);
  }

  // Return original MongoDB document or null (forcing cache miss)
  async get(key) {
    console.log(`DEBUG REDIS: Cache lookup for key: ${key} - forcing miss`);
    return null; // Always force a cache miss
  }

  // Just return success without caching
  async set(key, value, ttl = this.DEFAULT_TTL) {
    console.log(`DEBUG REDIS: Cache storage requested for key: ${key}`);
    return true;
  }

  async delete(key) {
    console.log(`DEBUG REDIS: Cache deletion for key: ${key}`);
    return true;
  }

  async deletePattern(pattern) {
    console.log(`DEBUG REDIS: Pattern deletion for: ${pattern}`);
    return true;
  }

  async clear() {
    console.log('DEBUG REDIS: Cache clear');
    return true;
  }

  disconnect() {
    console.log('DEBUG REDIS: Disconnect');
  }
}

// Export singleton
const debugRedisClient = new DebugRedisClient();
module.exports = debugRedisClient; 