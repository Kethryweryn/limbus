import { describe, expect, it } from 'vitest'
import { assertRateLimit, clientIp } from '~/server/utils/rateLimit'
import { fakeEvent } from '../helpers'

describe('clientIp', () => {
  it('prend la dernière IP de X-Forwarded-For quand la requête vient du proxy local', () => {
    const { event } = fakeEvent({ remoteAddress: '127.0.0.1', headers: { 'x-forwarded-for': '6.6.6.6, 203.0.113.7' } })
    expect(clientIp(event)).toBe('203.0.113.7')
  })

  it('ignore X-Forwarded-For quand la requête ne vient pas du proxy', () => {
    const { event } = fakeEvent({ remoteAddress: '198.51.100.2', headers: { 'x-forwarded-for': '6.6.6.6' } })
    expect(clientIp(event)).toBe('198.51.100.2')
  })

  it('ignore X-Real-IP, que le client peut forger', () => {
    const { event } = fakeEvent({ remoteAddress: '127.0.0.1', headers: { 'x-real-ip': '6.6.6.6' } })
    expect(clientIp(event)).toBe('127.0.0.1')
  })
})

describe('assertRateLimit', () => {
  const options = { name: `test-${Date.now()}`, limit: 3, windowMs: 60_000 }

  it('bloque au-delà de la limite même si le client change son X-Forwarded-For', () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { event } = fakeEvent({ headers: { 'x-forwarded-for': `10.0.0.${attempt}, 203.0.113.9` } })
      assertRateLimit(event, options)
    }

    const { event, responseHeaders } = fakeEvent({ headers: { 'x-forwarded-for': '10.0.0.99, 203.0.113.9' } })
    expect(() => assertRateLimit(event, options)).toThrow(expect.objectContaining({ statusCode: 429 }))
    expect(responseHeaders['retry-after']).toBeDefined()
  })

  it('compte séparément chaque IP réelle', () => {
    const { event } = fakeEvent({ headers: { 'x-forwarded-for': '203.0.113.10' } })
    expect(() => assertRateLimit(event, options)).not.toThrow()
  })
})
