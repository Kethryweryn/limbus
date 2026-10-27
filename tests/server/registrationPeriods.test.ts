import { describe, expect, it, vi } from 'vitest'
import { prisma } from '~/server/utils/prisma'
import { registrationPeriodSchema } from '~/server/utils/schemas'
import { resolveRegistrationPeriodSessions, rethrowSessionAlreadyTaken } from '~/server/utils/registrationPeriods'

const valid = { name: 'Printemps', gameId: 'game-1', sessions: [{ sessionId: 'session-1' }] }

describe('registrationPeriodSchema', () => {
  it('applique les valeurs par défaut', () => {
    expect(registrationPeriodSchema.parse(valid)).toMatchObject({
      entryMode: 'invitation',
      state: 'draft',
      responseDelayDays: 7
    })
  })

  it.each([
    ['sans session', { ...valid, sessions: [] }],
    ['session en double', { ...valid, sessions: [{ sessionId: 's' }, { sessionId: 's' }] }],
    ['places négatives', { ...valid, sessions: [{ sessionId: 's', seats: -1 }] }],
    ['délai nul', { ...valid, responseDelayDays: 0 }],
    ['date invalide', { ...valid, closesAt: 'demain' }],
    ['formulaire public, pas encore disponible', { ...valid, entryMode: 'form' }],
    ['état inconnu', { ...valid, state: 'archived' }]
  ])('refuse : %s', (_label, body) => {
    expect(registrationPeriodSchema.safeParse(body).success).toBe(false)
  })
})

describe('resolveRegistrationPeriodSessions', () => {
  function mockSessions(sessions: unknown[], playableCharacters = 12) {
    Object.assign(prisma, {
      session: { findMany: vi.fn().mockResolvedValue(sessions) },
      character: { count: vi.fn().mockResolvedValue(playableCharacters) }
    })
  }

  it('propose par défaut autant de places que de personnages PJ', async () => {
    mockSessions([{ id: 's1', name: 'S1', registrationPeriodLink: null }, { id: 's2', name: 'S2', registrationPeriodLink: null }])

    await expect(resolveRegistrationPeriodSessions('game-1', [{ sessionId: 's1' }, { sessionId: 's2', seats: 3 }]))
      .resolves.toEqual([{ sessionId: 's1', seats: 12 }, { sessionId: 's2', seats: 3 }])
  })

  it('refuse une session d’un autre jeu', async () => {
    mockSessions([])
    await expect(resolveRegistrationPeriodSessions('game-1', [{ sessionId: 'ailleurs' }]))
      .rejects.toMatchObject({ statusCode: 400 })
  })

  it('refuse une session déjà rattachée à une autre période, mais pas à la période modifiée', async () => {
    const taken = { id: 's1', name: 'S1', registrationPeriodLink: { periodId: 'p-autre', period: { name: 'Autre' } } }
    mockSessions([taken])
    await expect(resolveRegistrationPeriodSessions('game-1', [{ sessionId: 's1', seats: 1 }], 'p-moi'))
      .rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('« Autre »') })

    mockSessions([{ ...taken, registrationPeriodLink: { periodId: 'p-moi', period: { name: 'Moi' } } }])
    await expect(resolveRegistrationPeriodSessions('game-1', [{ sessionId: 's1', seats: 1 }], 'p-moi'))
      .resolves.toEqual([{ sessionId: 's1', seats: 1 }])
  })
})

describe('rethrowSessionAlreadyTaken', () => {
  it('traduit la violation d’unicité de la session en 409, et laisse passer le reste', () => {
    expect(() => rethrowSessionAlreadyTaken({ code: 'P2002', meta: { target: ['sessionId'] } }))
      .toThrow(expect.objectContaining({ statusCode: 409 }))
    const other = new Error('autre')
    expect(() => rethrowSessionAlreadyTaken(other)).toThrow(other)
  })
})
