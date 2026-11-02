import { describe, expect, it } from 'vitest'
import { castProgress, formatEventDate, sessionFormPayload, sessionStatusMeta, toDatetimeLocal } from '~/utils/sessions'

// Fonctions partagées des écrans de session (US-116)
describe('sessions', () => {
  it('l’avancement du cast ne compte que les rôles joueurs', () => {
    expect(castProgress([
      { participantId: 'p1', character: { type: 'pj' } },
      { participant: { id: 'p2' }, character: { type: 'pj' } },
      { participantId: null, character: { type: 'pj' } },
      { participantId: 'p3', character: { type: 'pnj' } }
    ])).toEqual({ assigned: 2, total: 3, percent: 67 })
    expect(castProgress([])).toEqual({ assigned: 0, total: 0, percent: 0 })
  })

  it('un état inconnu s’affiche comme une session prévue', () => {
    expect(sessionStatusMeta('cancelled').label).toBe('Annulée')
    expect(sessionStatusMeta('inconnu')).toEqual(sessionStatusMeta('scheduled'))
  })

  it('prépare la date et le lieu pour le formulaire', () => {
    const date = new Date(2026, 10, 2, 18, 30)
    expect(toDatetimeLocal(date)).toBe('2026-11-02T18:30')
    expect(toDatetimeLocal(null)).toBe('')
    expect(sessionFormPayload({ id: 's1', date: null, locationId: null })).toEqual({ id: 's1', date: '', locationId: '' })
  })

  it('une date d’envoi absente reste vide', () => {
    expect(formatEventDate(null)).toBe('')
    expect(formatEventDate('2026-11-02T10:05:00')).toContain('02/11/2026')
  })
})
