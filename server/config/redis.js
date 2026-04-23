const { createClient } = require('redis');

let client;
let isMock = false;

// Mock implementation for development/fallback
const mockClient = {
    lists: {},
    async connect() { 
        console.log('[Redis Mock] Mock client connected (In-Memory).'); 
        return Promise.resolve();
    },
    async quit() { return Promise.resolve(); },
    async disconnect() { return Promise.resolve(); },
    on(event, cb) { 
        // Trigger connect/ready immediately for the mock
        if (event === 'connect' || event === 'ready') {
            setTimeout(cb, 100); 
        }
        return this;
    },
    async lRem(key, count, value) {
        if (!this.lists[key]) return 0;
        // Simple implementation: removes first occurrence if count=0/1
        // Redis lRem count=0 means remove all. 
        if (count === 0) {
             const originalLength = this.lists[key].length;
             this.lists[key] = this.lists[key].filter(v => v !== value);
             return originalLength - this.lists[key].length;
        }
        const idx = this.lists[key].indexOf(value);
        if (idx > -1) {
            this.lists[key].splice(idx, 1);
            return 1;
        }
        return 0;
    },
    async lPop(key) {
        if (!this.lists[key] || this.lists[key].length === 0) return null;
        return this.lists[key].shift();
    },
    async rPush(key, value) {
        if (!this.lists[key]) this.lists[key] = [];
        this.lists[key].push(value);
        return this.lists[key].length;
    }
};

try {
    client = createClient({
        url: process.env.REDIS_URL
    });

    client.on('error', (err) => {
        // If connection is refused, enable mock mode
        if (!isMock && (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND')) {
            console.warn('[Redis] Connection refused. Falling back to In-Memory Mock.');
            isMock = true;
        } else if (!isMock) {
            console.error('[Redis] Error:', err.message);
        }
    });

    client.on('connect', () => {
        if (!isMock) console.log('[Redis] Connected to Redis server.');
    });

    client.connect().catch(err => {
        if (!isMock) {
            console.warn('[Redis] Initial connection failed. Using Mock.');
            isMock = true;
        }
    });

} catch (error) {
    console.warn('[Redis] Fatal error creating client. Using Mock.');
    isMock = true;
}

// Export a proxy that delegates to either the real client or the mock
module.exports = new Proxy({}, {
    get(target, prop) {
        const targetObj = isMock ? mockClient : client;
        
        // Handle undefined targetObj (shouldn't happen but for safety)
        if (!targetObj) return undefined;

        const value = targetObj[prop];
        
        // Bind functions to their original object to preserve 'this'
        if (typeof value === 'function') {
            return value.bind(targetObj);
        }
        return value;
    }
});