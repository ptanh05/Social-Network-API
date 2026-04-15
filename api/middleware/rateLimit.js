import { rateLimitResponse } from '../lib/utils.js';
const rateLimits = new Map();
const loginLimits = new Map();
function checkLimit(store, key, max, windowMs) {
    const now = Date.now();
    const record = store.get(key) || { count: 0, resetAt: now + windowMs };
    if (now > record.resetAt) {
        record.count = 0;
        record.resetAt = now + windowMs;
    }
    record.count++;
    store.set(key, record);
    if (record.count > max)
        return { limited: true, retryAfter: Math.ceil((record.resetAt - now) / 1000) };
    return { limited: false, retryAfter: 0 };
}
export function getClientIp(req) {
    return (req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] ||
        'unknown');
}
export function withRateLimit(handler, options = {}) {
    const { max = 100, windowMs = 15 * 60 * 1000 } = options;
    return async (req, res, _next) => {
        const ip = getClientIp(req);
        const { limited, retryAfter } = checkLimit(rateLimits, ip, max, windowMs);
        if (limited)
            return rateLimitResponse(res, retryAfter);
        await handler(req, res);
    };
}
export function withLoginLimit(handler) {
    return async (req, res, _next) => {
        const ip = getClientIp(req);
        const { limited, retryAfter } = checkLimit(loginLimits, ip, 10, 15 * 60 * 1000);
        if (limited)
            return rateLimitResponse(res, retryAfter);
        await handler(req, res);
    };
}
