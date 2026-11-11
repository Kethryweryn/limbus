import { describe, expect, it } from 'vitest'
import { isParticipantSlug, participantSlug } from '~/utils/participantSlug'

// Adresse de page d'une fiche (SPEC-022, US-239) : neutre, sans le nom
describe('participantSlug', () => {
  it('donne « p- » et dix caractères sans ambiguïté, jamais le nom', () => {
    const slug = participantSlug()
    expect(isParticipantSlug(slug)).toBe(true)
    expect(participantSlug(() => new Uint8Array(10))).toBe('p-aaaaaaaaaa')
    expect(new Set(Array.from({ length: 50 }, () => participantSlug())).size).toBe(50)
  })
})
