import { describe, expect, it } from 'vitest'
import { isOpenableSession } from '~/utils/registrationPeriods'

const now = new Date('2026-11-01T12:00:00Z')

describe('isOpenableSession (R6)', () => {
  it('une session prévue, datée et à venir', () => {
    expect(isOpenableSession({ status: 'scheduled', date: '2026-12-01T00:00:00Z' }, now)).toBe(true)
    expect(isOpenableSession({ status: 'scheduled', date: new Date('2026-12-01T00:00:00Z') }, now)).toBe(true)
  })

  it('pas une session sans date, passée, annulée, terminée ou reportée', () => {
    expect(isOpenableSession({ status: 'scheduled', date: null }, now)).toBe(false)
    expect(isOpenableSession({ status: 'scheduled', date: '2026-10-01T00:00:00Z' }, now)).toBe(false)
    expect(isOpenableSession({ status: 'cancelled', date: '2026-12-01T00:00:00Z' }, now)).toBe(false)
    expect(isOpenableSession({ status: 'completed', date: '2026-12-01T00:00:00Z' }, now)).toBe(false)
    expect(isOpenableSession({ status: 'postponed', date: '2026-12-01T00:00:00Z' }, now)).toBe(false)
  })
})
