import { describe, expect, it } from 'vitest'
import { isQueueableApiWrite } from '~/utils/offlineSync'

describe('écritures mises en file hors ligne', () => {
  it('garde les créations et modifications de données', () => {
    expect(isQueueableApiWrite('/api/sessions', { method: 'POST', body: {} })).toBe(true)
    expect(isQueueableApiWrite('/api/sessions/s1', { method: 'PUT', body: {} })).toBe(true)
    expect(isQueueableApiWrite('/api/sessions/s1/timeline', { method: 'PUT', body: {} })).toBe(true)
    expect(isQueueableApiWrite('/api/characters/c1', { method: 'DELETE' })).toBe(true)
  })

  it('n’y met jamais une action comme un envoi d’emails', () => {
    expect(isQueueableApiWrite('/api/sessions/s1/allergies/send', { method: 'POST' })).toBe(false)
    expect(isQueueableApiWrite('/api/sessions/s1/payments/send', { method: 'POST', body: {} })).toBe(false)
    expect(isQueueableApiWrite('/api/games/g1/bequests', { method: 'POST', body: {} })).toBe(false)
    expect(isQueueableApiWrite('/api/games/g1/bequests/i1', { method: 'DELETE' })).toBe(false)
    expect(isQueueableApiWrite('/api/games/g1/shares/u1', { method: 'DELETE' })).toBe(false)
  })
})
