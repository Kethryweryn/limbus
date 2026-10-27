import jwt from 'jsonwebtoken'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireAuthUser, signAuthToken } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { fakeEvent } from '../helpers'
import { runtimeConfig } from '../setup'

const SECRET = 'secret-jwt-de-test'
const USER = { id: 'user-1', email: 'orga@example.test', name: 'Orga', role: 'organizer' }
const findUnique = vi.fn()

function eventWithToken(token: string) {
  return fakeEvent({ headers: { cookie: `limbus_token=${token}` } }).event
}

beforeEach(() => {
  runtimeConfig.jwtSecret = SECRET
  findUnique.mockReset().mockImplementation(async ({ where }) => (where.id === USER.id ? USER : null))
  Object.assign(prisma, { user: { findUnique } })
})

describe('requireAuthUser', () => {
  it('accepte un jeton valide et relit l’utilisateur en base', async () => {
    const token = signAuthToken({ id: USER.id, role: 'admin' })
    await expect(requireAuthUser(eventWithToken(token))).resolves.toEqual(USER)
  })

  it('refuse une requête sans cookie', async () => {
    await expect(requireAuthUser(fakeEvent().event)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('refuse un jeton signé avec un autre secret', async () => {
    const token = jwt.sign({ id: USER.id }, 'autre-secret')
    await expect(requireAuthUser(eventWithToken(token))).rejects.toMatchObject({ statusCode: 401 })
  })

  it('refuse un jeton non signé (alg: none)', async () => {
    const token = jwt.sign({ id: USER.id }, '', { algorithm: 'none' })
    await expect(requireAuthUser(eventWithToken(token))).rejects.toMatchObject({ statusCode: 401 })
  })

  it('refuse un jeton sans id, même avec un email valide', async () => {
    const token = signAuthToken({ email: USER.email })
    await expect(requireAuthUser(eventWithToken(token))).rejects.toMatchObject({ statusCode: 401 })
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('refuse un jeton d’un utilisateur supprimé', async () => {
    const token = signAuthToken({ id: 'utilisateur-supprime' })
    await expect(requireAuthUser(eventWithToken(token))).rejects.toMatchObject({ statusCode: 401 })
  })
})
