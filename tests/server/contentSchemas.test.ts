import { describe, expect, it } from 'vitest'
import { intrigueSchema } from '~/server/utils/schemas'

describe('intrigueSchema (US-015)', () => {
  it('ignore « prête à envoyer », qui n’a pas d’effet sur une intrigue', () => {
    const parsed = intrigueSchema.parse({ name: 'Le complot', gameId: 'jeu', readyToSend: true })
    expect(parsed).not.toHaveProperty('readyToSend')
    expect(parsed.name).toBe('Le complot')
  })
})
