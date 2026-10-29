import { describe, expect, it } from 'vitest'
import { participantWithSeveralPjs } from '~/server/utils/sessionAssignments'

const characters = new Map([['aube', { type: 'pj' }], ['brume', { type: 'pj' }], ['garde', { type: 'pnj' }], ['veilleur', { type: 'pnj' }]])

describe('participantWithSeveralPjs (US-017)', () => {
  it('trouve un participant qui joue deux PJ', () => {
    expect(participantWithSeveralPjs([
      { characterId: 'aube', participantId: 'lea' },
      { characterId: 'brume', participantId: 'lea' }
    ], characters)).toBe('lea')
  })

  it('ne compte ni les PNJ ni les personnages sans participant', () => {
    expect(participantWithSeveralPjs([
      { characterId: 'aube', participantId: 'lea' },
      { characterId: 'garde', participantId: 'lea' },
      { characterId: 'veilleur', participantId: 'lea' },
      { characterId: 'brume', participantId: null }
    ], characters)).toBeNull()
  })
})
