import { describe, expect, it } from 'vitest'
import { characterPlan, filesIn, isUpcoming, participantPlan, sessionPlan } from '~/utils/offlinePlan'

// Adresses partagées entre les pages et le téléchargement d'un jeu (SPEC-019, US-226, ADR-0081)
describe('plan des lectures', () => {
  it('donne les lectures d’une fiche de personnage, d’un participant et d’une session', () => {
    expect(characterPlan({ id: 'c1', slug: 'aube', gameId: 'g1' })).toEqual([
      '/api/characters/slug/aube', '/api/factions?gameId=g1', '/api/intrigues?gameId=g1', '/api/characters?gameId=g1',
      '/api/characters/c1/relations', '/api/characters/c1/trombinoscope'
    ])
    expect(participantPlan({ id: 'p1', slug: 'lea' })).toContain('/api/participants/p1/emergency')
    expect(sessionPlan({ id: 's1', slug: 'soiree' })).toEqual([
      '/api/sessions/slug/soiree', '/api/sessions/s1/timeline', '/api/sessions/s1/documents', '/api/sessions/s1/payments',
      '/api/sessions/s1/allergies', '/api/sessions/s1/attendance'
    ])
  })
})

describe('filesIn', () => {
  it('relève les PDF et les photos d’une session, à toute profondeur, sans doublon', () => {
    const found = filesIn({
      assignments: [{ photoUrl: '/api/uploads/session-assignment-photos/a.jpg' }, { photoUrl: '/api/uploads/session-assignment-photos/a.jpg' }],
      sheets: [{ characterSheetPdfUrl: '/api/sessions/s1/documents/character-sheets/c1/pdf', trombinoscopeUrl: '/api/sessions/s1/trombinoscopes/c1' }],
      documents: [{ pdfUrl: '/api/sessions/s1/documents/d1/pdf', title: 'Règles' }],
      other: '/api/sessions/s1/payments'
    })
    expect([...found].sort()).toEqual([
      '/api/sessions/s1/documents/character-sheets/c1/pdf',
      '/api/sessions/s1/documents/d1/pdf',
      '/api/sessions/s1/trombinoscopes/c1',
      '/api/uploads/session-assignment-photos/a.jpg'
    ])
  })
})

describe('isUpcoming', () => {
  const now = new Date('2026-11-10T15:00:00Z')
  it('une session sans date, du jour ou à venir l’est ; une session passée non', () => {
    expect(isUpcoming({ date: null }, now)).toBe(true)
    expect(isUpcoming({ date: '2026-11-10T08:00:00Z' }, now)).toBe(true)
    expect(isUpcoming({ date: '2026-12-01T18:00:00Z' }, now)).toBe(true)
    expect(isUpcoming({ date: '2026-11-01T18:00:00Z' }, now)).toBe(false)
  })
})
