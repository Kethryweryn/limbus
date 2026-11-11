import { describe, expect, it } from 'vitest'
import { inGameSentence, inSentence, sessionDayKey, sessionDayLabel, sessionHourLabel, sessionLabels, withGame } from '~/utils/sessionLabels'

// SPEC-021 : libellé d'une session, à l'heure de Paris
describe('libellé d’une session (R1, R2)', () => {
  it('donne le jour en toutes lettres, « 1er » pour le premier du mois, ou « sans date »', () => {
    expect(sessionDayLabel('2099-05-15T12:00:00Z')).toBe('Session du 15 mai 2099')
    expect(sessionDayLabel('2099-05-01T12:00:00Z')).toBe('Session du 1er mai 2099')
    expect(sessionDayLabel(null)).toBe('Session sans date')
  })

  it('lit le jour et l’heure à Paris', () => {
    // 23 h 30 UTC le 14 mai : déjà le 15 à Paris (heure d'été)
    expect(sessionDayKey('2099-05-14T23:30:00Z')).toBe('2099-05-15')
    expect(sessionHourLabel('2099-05-15T12:00:00Z')).toBe('14 h')
    expect(sessionHourLabel('2099-05-15T12:30:00Z')).toBe('14 h 30')
  })

  it('n’ajoute l’heure, puis le lieu, puis un numéro qu’en cas de doublon', () => {
    const labels = sessionLabels([
      { id: 'seule', date: '2099-06-01T08:00:00Z', createdAt: '2026-01-01' },
      { id: 'matin', date: '2099-05-15T08:00:00Z', createdAt: '2026-01-01' },
      { id: 'soir', date: '2099-05-15T17:00:00Z', createdAt: '2026-01-02', locationName: 'Grange' },
      { id: 'soir-salle', date: '2099-05-15T17:00:00Z', createdAt: '2026-01-03', locationName: 'Salle' },
      { id: 'a', date: null, createdAt: '2026-01-01' },
      { id: 'b', date: null, createdAt: '2026-01-02' },
      { id: 'c', date: null, createdAt: '2026-01-03', locationName: 'Forêt' }
    ])
    expect(labels.get('seule')).toBe('Session du 1er juin 2099')
    expect(labels.get('matin')).toBe('Session du 15 mai 2099, 10 h')
    expect(labels.get('soir')).toBe('Session du 15 mai 2099, 19 h — Grange')
    expect(labels.get('soir-salle')).toBe('Session du 15 mai 2099, 19 h — Salle')
    expect(labels.get('a')).toBe('Session sans date')
    expect(labels.get('b')).toBe('Session sans date (2)')
    expect(labels.get('c')).toBe('Session sans date — Forêt')
  })
})

describe('libellé dans une phrase et hors des pages du jeu (R4)', () => {
  it('se place au fil d’une phrase, avec le jeu devant hors des pages du jeu', () => {
    expect(inSentence('Session du 15 mai 2099')).toBe('session du 15 mai 2099')
    expect(withGame('Station Meridian', 'Session du 15 mai 2099')).toBe('Station Meridian — Session du 15 mai 2099')
    expect(inGameSentence('Station Meridian', 'Session sans date')).toBe('la session sans date de « Station Meridian »')
  })
})
