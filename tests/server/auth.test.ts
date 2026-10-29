import jwt from 'jsonwebtoken'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireAdmin, requireAuthUser, requireUser, signAuthToken } from '~/server/utils/auth'
import { prisma } from '~/server/utils/prisma'
import { fakeEvent } from '../helpers'
import { runtimeConfig } from '../setup'

const SECRET = 'secret-jwt-de-test'
const USER = { id: 'user-1', email: 'orga@example.test', name: 'Orga', role: 'user' }
const AUTH_USER = { ...USER, emailConfirmed: true }
const findUnique = vi.fn()
let sessionVersion = 0
let role = USER.role
let emailConfirmedAt: Date | null = new Date()
let disabledAt: Date | null = null

function eventWithToken(token: string) {
  return fakeEvent({ headers: { cookie: `limbus_token=${token}` } }).event
}

beforeEach(() => {
  sessionVersion = 0
  role = USER.role
  emailConfirmedAt = new Date()
  disabledAt = null
  runtimeConfig.jwtSecret = SECRET
  findUnique.mockReset().mockImplementation(async ({ where }) => (where.id === USER.id ? { ...USER, role, sessionVersion, emailConfirmedAt, disabledAt } : null))
  Object.assign(prisma, { user: { findUnique } })
})

describe('requireAuthUser', () => {
  it('accepte un jeton valide et relit l’utilisateur en base', async () => {
    const token = signAuthToken({ id: USER.id, role: 'admin' })
    await expect(requireAuthUser(eventWithToken(token))).resolves.toEqual(AUTH_USER)
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

  it('refuse un jeton émis avant une révocation des sessions', async () => {
    const token = signAuthToken({ id: USER.id, v: 0 })
    sessionVersion = 1
    await expect(requireAuthUser(eventWithToken(token))).rejects.toMatchObject({ statusCode: 401 })
  })

  it('accepte un jeton de la version de session courante, sans exposer la version', async () => {
    sessionVersion = 2
    const token = signAuthToken({ id: USER.id, v: 2 })
    const user = await requireAuthUser(eventWithToken(token))
    expect(user).toEqual(AUTH_USER)
    expect(user).not.toHaveProperty('sessionVersion')
  })

  it('refuse un jeton d’un utilisateur supprimé', async () => {
    const token = signAuthToken({ id: 'utilisateur-supprime' })
    await expect(requireAuthUser(eventWithToken(token))).rejects.toMatchObject({ statusCode: 401 })
  })

  it('refuse un compte désactivé (US-065)', async () => {
    disabledAt = new Date()
    await expect(requireAuthUser(eventWithToken(signAuthToken({ id: USER.id })))).rejects.toMatchObject({ statusCode: 401 })
  })

  it('refuse une adresse non confirmée, sauf aux routes qui l’acceptent (US-061, R5)', async () => {
    emailConfirmedAt = null
    await expect(requireUser(eventWithToken(signAuthToken({ id: USER.id })))).rejects.toMatchObject({ statusCode: 403, data: { unconfirmed: true } })
    await expect(requireAuthUser(eventWithToken(signAuthToken({ id: USER.id })), { allowUnconfirmed: true })).resolves.toMatchObject({ emailConfirmed: false })
  })
})

describe('un seul rôle global (US-058, ADR-0038)', () => {
  it.each(['user', 'admin'])('requireUser accepte un compte « %s »', async (value) => {
    role = value
    await expect(requireUser(eventWithToken(signAuthToken({ id: USER.id })))).resolves.toMatchObject({ role: value })
  })

  it('requireAdmin refuse un compte simple', async () => {
    role = 'user'
    await expect(requireAdmin(eventWithToken(signAuthToken({ id: USER.id })))).rejects.toMatchObject({ statusCode: 403 })
  })
})
