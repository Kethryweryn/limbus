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

const TRUSTED_PROXIES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

// Seul le reverse proxy local est cru : il ajoute l'IP réelle en DERNIER dans
// X-Forwarded-For. Les valeurs précédentes viennent du client et sont falsifiables.
export function clientIp(event: H3Event) {
  const remoteAddress = event.node.req.socket.remoteAddress || 'unknown'
  if (!TRUSTED_PROXIES.has(remoteAddress)) return remoteAddress

  const forwardedFor = getHeader(event, 'x-forwarded-for')
  const lastForwardedIp = forwardedFor?.split(',').at(-1)?.trim()
  return lastForwardedIp || remoteAddress
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
    setHeader(event, 'Retry-After', retryAfterSeconds)
    throw createError({
      statusCode: 429,
      message: 'Trop de tentatives. Réessaie dans quelques minutes.'
    })
  }
}

export function authUserRateLimitKey(event: H3Event) {
  const user = event.context.authUser
  return user?.id || user?.email || 'anonymous'
}
