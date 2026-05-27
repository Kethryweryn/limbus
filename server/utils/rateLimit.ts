import type { H3Event } from 'h3'

type RateLimitOptions = {
  name: string
  limit: number
  windowMs: number
  keyParts?: Array<string | number | null | undefined>
}

type RateLimitBucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, RateLimitBucket>()
let cleanupCounter = 0

function clientIp(event: H3Event) {
  const forwardedFor = getHeader(event, 'x-forwarded-for')
  const forwardedValue = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor
  const firstForwardedIp = forwardedValue?.split(',')[0]?.trim()
  return firstForwardedIp
    || getHeader(event, 'x-real-ip')
    || event.node.req.socket.remoteAddress
    || 'unknown'
}

function cleanExpiredBuckets(now: number) {
  cleanupCounter += 1
  if (cleanupCounter % 100 !== 0) return

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key)
    }
  }
}

function normalizedPart(value: string | number | null | undefined) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._:-]+/g, '_')
    .slice(0, 120)
}

export function assertRateLimit(event: H3Event, options: RateLimitOptions) {
  const now = Date.now()
  cleanExpiredBuckets(now)

  const key = [
    options.name,
    clientIp(event),
    ...options.keyParts?.map(normalizedPart) || []
  ].join(':')

  const existing = buckets.get(key)
  const bucket = existing && existing.resetAt > now
    ? existing
    : { count: 0, resetAt: now + options.windowMs }

  bucket.count += 1
  buckets.set(key, bucket)

  const remaining = Math.max(0, options.limit - bucket.count)
  setHeader(event, 'X-RateLimit-Limit', String(options.limit))
  setHeader(event, 'X-RateLimit-Remaining', String(remaining))
  setHeader(event, 'X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)))

  if (bucket.count > options.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    setHeader(event, 'Retry-After', String(retryAfterSeconds))
    throw createError({
      statusCode: 429,
      message: 'Trop de tentatives. Réessaie dans quelques minutes.'
    })
  }
}

export function authUserRateLimitKey(event: H3Event) {
  const user = (event.context as any).authUser
  return user?.id || user?.email || 'anonymous'
}
