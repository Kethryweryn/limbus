import { describe, expect, it } from 'vitest'
import { isParticipantEmail, needsParticipantEmail } from '~/utils/participantEmail'

// Adresse d'une fiche (SPEC-022 R3, US-238)
describe('adresse d’une fiche', () => {
  it('accepte une adresse bien formée, refuse le vide et une adresse mal formée', () => {
    expect(isParticipantEmail(' paul@example.test ')).toBe(true)
    expect(isParticipantEmail('paul@')).toBe(false)
    expect(isParticipantEmail('')).toBe(false)
    expect(needsParticipantEmail(null)).toBe(true)
    expect(needsParticipantEmail('à demander')).toBe(true)
    expect(needsParticipantEmail('paul@example.test')).toBe(false)
  })
})
