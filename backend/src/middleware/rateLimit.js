import { error } from '../lib/errors.js'

// Simple in-memory rate limiter for Vercel serverless
const store = new Map()

export function rateLimit(options = {}) {
  const { windowMs = 15 * 60 * 1000, max = 100 } = options
  return (request) => {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const key = `${ip}:${request.method}`
    const now = Date.now()
    const record = store.get(key) || { count: 0, resetAt: now + windowMs }
    if (now > record.resetAt) {
      record.count = 0
      record.resetAt = now + windowMs
    }
    record.count++
    store.set(key, record)
    if (record.count > max) {
      return {
        limited: true,
        retryAfter: Math.ceil((record.resetAt - now) / 1000),
      }
    }
    return { limited: false }
  }
}

// Apply to a handler, return 429 if rate limited
export function withRateLimit(handler, options) {
  const limiter = rateLimit(options)
  return async (request, ...args) => {
    const result = limiter(request)
    if (result.limited) {
      return error(429, `Too many requests. Retry after ${result.retryAfter}s`)
    }
    return handler(request, ...args)
  }
}
