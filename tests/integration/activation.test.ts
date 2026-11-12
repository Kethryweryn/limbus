// US-246 (SPEC-022 R2, R9, R11, ADR-0088) : activer un compte pré-créé par un lien reçu à son adresse, depuis la page
// « Activer mon compte », « Mot de passe oublié », l'inscription libre ou une invitation à co-organiser
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { TERMS_VERSION } from '~/utils/legal'
import bcrypt from 'bcrypt'
import { api } from './api'
import { createTestPrisma } from './db'
import { startTestSmtp, type ReceivedEmail } from './smtp'

const world = inject('world')
const { alice } = world.users
const prisma = createTestPrisma()
let smtp: Awaited<ReturnType<typeof startTestSmtp>>
let counter = 0

beforeAll(async () => {
  smtp = await startTestSmtp(prisma)
})

afterAll(async () => {
  await smtp.stop()
  await prisma.$disconnect()
})

const fromIp = () => ({ headers: { 'x-forwarded-for': `10.46.${Math.floor(++counter / 250)}.${counter % 250}` } })
const unique = (name: string) => `${name}-${++counter}@example.test`
const sentTo = (email: string, since: number) => smtp.received.slice(since).filter((received) => received.to.includes(email))
const linkIn = (message: ReceivedEmail | undefined, path: string) => message?.text.match(new RegExp(`/${path}/([\\w-]+)`))?.[1]

async function login(email: string, password: string) {
  return await fetch(`${inject('baseUrl')}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...fromIp().headers },
    body: JSON.stringify({ email, password })
  })
}

// Fiche créée par Alice à une adresse sans compte : le compte est pré-créé (US-244)
// Session posée par une réponse : le cookie de connexion, rejoué tel quel
const sessionOf = (response: Response) => response.headers.getSetCookie().find((cookie) => cookie.startsWith('__Host-limbus_token='))?.split(';')[0] ?? ''

async function post(path: string, body: unknown) {
  return await fetch(`${inject('baseUrl')}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: inject('baseUrl'), ...fromIp().headers },
    body: JSON.stringify(body)
  })
}

async function preCreated(key: string) {
  const email = unique(key)
  const response = await api(alice, 'POST', '/api/participants', { name: 'Nom chez Alice', email, phone: '0100000000', gameIds: [world.a.game.id] })
  expect(response.status, JSON.stringify(response.body)).toBe(200)
  const fiche = response.body as { id: string }
  return { email, fiche, account: await prisma.user.findUniqueOrThrow({ where: { email } }) }
}

async function requestActivation(email: string) {
  const sent = smtp.received.length
  const response = await api(null, 'POST', '/api/auth/activation-request', { email }, fromIp())
  expect(response.status).toBe(200)
  return sentTo(email, sent)
}

describe('activer mon compte (US-246)', () => {
  it('la page répond pareil pour tous, et seul un compte non activé reçoit le lien', async () => {
    expect(await requestActivation(unique('inconnue'))).toEqual([])

    const { email } = await preCreated('a-activer')
    const [activation] = await requestActivation(email)
    expect(activation?.subject).toBe('Activez votre compte Limbus')
    expect(linkIn(activation, 'acces/activer')).toBeTruthy()

    const activated = await prisma.user.create({ data: { email: unique('deja-active'), name: 'Active', password: await bcrypt.hash(randomUUID(), 4) } })
    const [exists] = await requestActivation(activated.email)
    expect(exists?.subject).toBe('Vous avez déjà un compte Limbus')
  })

  it('le lien active le compte : nom, mot de passe et conditions, fiches au nom choisi, coordonnées vides', async () => {
    const { email, fiche, account } = await preCreated('activee')
    const token = linkIn((await requestActivation(email))[0], 'acces/activer')!
    const password = randomUUID()

    const response = await api(null, 'POST', '/api/auth/activate', { token, name: 'Paul Martin', password, termsAccepted: true }, fromIp())
    expect(response.status, JSON.stringify(response.body)).toBe(200)

    const activated = await prisma.user.findUniqueOrThrow({ where: { id: account.id } })
    expect(activated).toMatchObject({ name: 'Paul Martin', termsAcceptedVersion: TERMS_VERSION, phone: null, dietary: null })
    expect(activated.emailConfirmedAt).not.toBeNull()
    // Son nom est recopié ; le téléphone, qu'il n'a pas rempli, reste celui de l'équipe (ADR-0089)
    expect(await prisma.participantGame.findUniqueOrThrow({ where: { participantId_gameId: { participantId: fiche.id, gameId: world.a.game.id } }, select: { name: true, phone: true } }))
      .toEqual({ name: 'Paul Martin', phone: '0100000000' })
    const session = await login(email, password)
    expect(session.status).toBe(200)
    const participations = await fetch(`${inject('baseUrl')}/api/me/participations`, { headers: { cookie: sessionOf(session) } })
    expect(participations.status).toBe(200)
    expect(await participations.text()).toContain(world.a.game.id)

    // Le lien ne sert qu'une fois
    const again = await api(null, 'POST', '/api/auth/activate', { token, name: 'Autre', password: randomUUID(), termsAccepted: true }, fromIp())
    expect(again.status).toBe(400)
    expect(JSON.stringify(again.body)).toContain('Ce lien n’est plus valable')
  })

  it('refuse un nom vide, un mot de passe trop court, des conditions non acceptées, un lien expiré, sans rien changer', async () => {
    const { email, account } = await preCreated('saisie-invalide')
    const token = linkIn((await requestActivation(email))[0], 'acces/activer')!
    const valid = { token, name: 'Paul', password: randomUUID(), termsAccepted: true }
    for (const invalid of [{ ...valid, name: '' }, { ...valid, password: 'court' }, { ...valid, termsAccepted: false }]) {
      expect((await api(null, 'POST', '/api/auth/activate', invalid, fromIp())).status).toBe(400)
    }
    expect(await prisma.user.findUniqueOrThrow({ where: { id: account.id } })).toMatchObject({ password: null, emailConfirmedAt: null, name: '' })

    await prisma.accountToken.updateMany({ where: { userId: account.id, kind: 'activate' }, data: { expiresAt: new Date(Date.now() - 1000) } })
    const expired = await api(null, 'POST', '/api/auth/activate', valid, fromIp())
    expect(expired.status).toBe(400)
    expect(JSON.stringify(expired.body)).toContain('Ce lien a expiré')
    expect((await prisma.user.findUniqueOrThrow({ where: { id: account.id } })).password).toBeNull()
  })

  it('« Mot de passe oublié » envoie à un compte non activé le lien d’activation', async () => {
    const { email } = await preCreated('oubliee')
    const sent = smtp.received.length
    expect((await api(null, 'POST', '/api/auth/password-forgotten', { email }, fromIp())).status).toBe(200)
    const [message] = sentTo(email, sent)
    expect(message?.subject).toBe('Activez votre compte Limbus')
    expect(linkIn(message, 'acces/activer')).toBeTruthy()
  })

  it('l’inscription libre sur un compte non activé n’écrit rien avant la confirmation, qui l’active avec le nom saisi', async () => {
    const { email, fiche, account } = await preCreated('inscrite')
    const password = randomUUID()
    const sent = smtp.received.length
    const signup = await api(null, 'POST', '/api/auth/signup', { name: 'Paule Inscrite', email, password, termsAccepted: true }, fromIp())
    expect(signup.status).toBe(200)
    expect(await prisma.user.findUniqueOrThrow({ where: { id: account.id } })).toMatchObject({ name: '', password: null, termsAcceptedVersion: null })

    const token = linkIn(sentTo(email, sent)[0], 'acces/confirmer')!
    expect((await api(null, 'POST', '/api/auth/confirm', { token })).status).toBe(200)
    const activated = await prisma.user.findUniqueOrThrow({ where: { id: account.id } })
    expect(activated).toMatchObject({ name: 'Paule Inscrite', termsAcceptedVersion: TERMS_VERSION })
    expect(activated.emailConfirmedAt).not.toBeNull()
    expect((await prisma.participantGame.findFirstOrThrow({ where: { participantId: fiche.id } })).name).toBe('Paule Inscrite')
    expect((await login(email, password)).status).toBe(200)
  })

  it('une invitation à co-organiser vers un compte non activé l’active, avec ses fiches', async () => {
    const { email, fiche, account } = await preCreated('co-organisatrice')
    const sent = smtp.received.length
    expect((await api(alice, 'POST', `/api/games/${world.a.game.id}/invitations`, { email })).status).toBe(200)
    const token = linkIn(sentTo(email, sent)[0], 'invitations')!

    const response = await post('/api/auth/register', { token, name: 'Coorga', password: randomUUID(), termsAccepted: true })
    const text = await response.text()
    expect(response.status, text).toBe(200)
    expect(text).not.toContain('sessionVersion')
    const activated = await prisma.user.findUniqueOrThrow({ where: { id: account.id } })
    expect(activated).toMatchObject({ name: 'Coorga', termsAcceptedVersion: TERMS_VERSION })
    expect(activated.emailConfirmedAt).not.toBeNull()
    expect((await prisma.participant.findUniqueOrThrow({ where: { id: fiche.id } })).userId).toBe(account.id)
    expect(await prisma.gameShare.count({ where: { gameId: world.a.game.id, userId: account.id } })).toBe(1)
    // Le cookie posé porte la version de session du compte repris : il ouvre bien la session
    const me = await fetch(`${inject('baseUrl')}/api/auth/me`, { headers: { cookie: sessionOf(response) } })
    expect(await me.text()).toContain(account.id)
  })
})
