import { describe, expect, it } from 'vitest'
import { isClosedSessionStatus, SESSION_STATUSES } from '~/utils/domain'

describe('isClosedSessionStatus (US-020)', () => {
  it('annulée et terminée sortent des listes courantes', () => {
    expect(isClosedSessionStatus(SESSION_STATUSES.cancelled)).toBe(true)
    expect(isClosedSessionStatus(SESSION_STATUSES.completed)).toBe(true)
  })

  it('prévue et reportée y restent', () => {
    expect(isClosedSessionStatus(SESSION_STATUSES.scheduled)).toBe(false)
    expect(isClosedSessionStatus(SESSION_STATUSES.postponed)).toBe(false)
    expect(isClosedSessionStatus(undefined)).toBe(false)
  })
})
