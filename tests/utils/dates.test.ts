import { describe, expect, it } from 'vitest'
import { PARIS_TIME_ZONE, formatLongDate, formatLongDateTime } from '~/utils/dates'

// Dates en toutes lettres (US-117)
describe('dates en toutes lettres', () => {
  it('un email ou une page publique donne le jour et l’heure de Paris', () => {
    // 23 h 30 à Paris le 2 novembre, déjà le 3 en UTC+14
    const date = '2026-11-02T22:30:00Z'
    expect(formatLongDate(date, PARIS_TIME_ZONE)).toBe('2 novembre 2026')
    expect(formatLongDateTime(date, PARIS_TIME_ZONE)).toBe('2 novembre 2026 à 23:30')
    expect(formatLongDate(date, 'Pacific/Kiritimati')).toBe('3 novembre 2026')
  })
})
