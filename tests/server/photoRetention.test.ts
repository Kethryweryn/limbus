import { describe, expect, it } from 'vitest'
import { photosExpireAt } from '~/server/utils/photoRetention'

// US-108 : échéance des photos d'une session
describe('échéance des photos', () => {
  it('tombe la durée du jeu après la date de la session', () => {
    expect(photosExpireAt({ date: new Date('2026-01-15T10:00:00Z') }, 6)?.toISOString()).toBe('2026-07-15T10:00:00.000Z')
  })

  it('n’existe pas pour une session sans date', () => {
    expect(photosExpireAt({ date: null }, 6)).toBeNull()
  })
})
