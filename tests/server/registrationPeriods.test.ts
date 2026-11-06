import { describe, expect, it, vi } from 'vitest'
import { registrationPeriodSchema, registrationPeriodUpdateSchema, registrationSessionSettingsSchema } from '~/server/utils/schemas'
import { rethrowPoolAlreadyExists, withFreshPublicId } from '~/server/utils/registrationPeriods'

const valid = { gameId: 'game-1' }

describe('registrationPeriodSchema', () => {
  it('applique les valeurs par défaut', () => {
    expect(registrationPeriodSchema.parse(valid)).toMatchObject({
      state: 'draft',
      responseDelayDays: 7,
      notifyTeam: false,
      replayPolicy: 'allowed'
    })
  })

  it.each([
    ['sans jeu', {}],
    ['délai nul', { ...valid, responseDelayDays: 0 }],
    ['rejoueurs inconnus', { ...valid, replayPolicy: 'jamais' }],
    ['état inconnu', { ...valid, state: 'archived' }]
  ])('refuse : %s', (_label, body) => {
    expect(registrationPeriodSchema.safeParse(body).success).toBe(false)
  })

  it('une modification sans état ni délai ne les remet pas à leur valeur par défaut', () => {
    expect(registrationPeriodUpdateSchema.parse(valid)).toEqual({ gameId: 'game-1' })
  })
})

describe('registrationSessionSettingsSchema (R6, R22)', () => {
  it('un champ absent reste absent', () => {
    expect(registrationSessionSettingsSchema.parse({ open: true })).toEqual({ open: true })
  })

  it('refuse un mode ou une liste d’attente invalides', () => {
    expect(registrationSessionSettingsSchema.safeParse({ selectionMode: 'loterie' }).success).toBe(false)
    expect(registrationSessionSettingsSchema.safeParse({ waitlistSize: -1 }).success).toBe(false)
  })
})

describe('rethrowPoolAlreadyExists (R1)', () => {
  it('traduit la violation d’unicité du jeu en 409, et laisse passer le reste', () => {
    expect(() => rethrowPoolAlreadyExists({ code: 'P2002', meta: { target: ['gameId'] } }))
      .toThrow(expect.objectContaining({ statusCode: 409 }))
    const other = new Error('autre')
    expect(() => rethrowPoolAlreadyExists(other)).toThrow(other)
  })
})

describe('withFreshPublicId', () => {
  it('tire un autre publicId en cas de collision', async () => {
    const create = vi.fn()
      .mockRejectedValueOnce({ code: 'P2002', meta: { target: ['publicId'] } })
      .mockResolvedValueOnce('créée')
    await expect(withFreshPublicId(create)).resolves.toBe('créée')
    expect(create.mock.calls[0]![0]).not.toBe(create.mock.calls[1]![0])
  })
})
