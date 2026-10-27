import { describe, expect, it } from 'vitest'
import { effectivePeriodState } from '~/utils/registrationPeriods'

const now = new Date('2026-11-01T12:00:00Z')

describe('effectivePeriodState', () => {
  it('garde les états brouillon et clôturé tels quels', () => {
    expect(effectivePeriodState({ state: 'draft', closesAt: '2026-10-01T00:00:00Z' }, now)).toBe('draft')
    expect(effectivePeriodState({ state: 'closed', closesAt: null }, now)).toBe('closed')
  })

  it('clôture une période ouverte dont la date de clôture est passée', () => {
    expect(effectivePeriodState({ state: 'open', closesAt: '2026-11-01T11:59:59Z' }, now)).toBe('closed')
    expect(effectivePeriodState({ state: 'open', closesAt: new Date('2026-11-01T12:00:00Z') }, now)).toBe('closed')
  })

  it('laisse ouverte une période sans date ou dont la date est à venir', () => {
    expect(effectivePeriodState({ state: 'open', closesAt: null }, now)).toBe('open')
    expect(effectivePeriodState({ state: 'open', closesAt: '2026-11-02T00:00:00Z' }, now)).toBe('open')
  })
})
