// US-244 (SPEC-022 R1, R2, ADR-0088) : toute fiche à une adresse appartient au compte de cette adresse, pré-créé non activé
// s'il n'existe pas, sans email ; on ne peut pas s'y connecter, et l'équipe garde la main sur la fiche
import { randomUUID } from 'node:crypto'
import bcrypt from 'bcrypt'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { api, bodyOf } from './api'
import { createTestPrisma } from './db'
import { startTestSmtp, type ReceivedEmail } from './smtp'

const world = inject('world')
const { alice, bob, admin } = world.users
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

const fromIp = () => ({ headers: { 'x-forwarded-for': `10.44.${Math.floor(++counter / 250)}.${counter % 250}` } })
const unique = (name: string) => `${name}-${++counter}@example.test`
const sentTo = (email: string, since: number) => smtp.received.slice(since).filter((received) => received.to.includes(email))
// Empreinte d'un mot de passe tiré au hasard : aucun mot de passe écrit en clair dans les tests
const someHash = async () => await bcrypt.hash(randomUUID(), 4)
const linkIn = (message: ReceivedEmail, path: string) => message.text.match(new RegExp(`/${path}/([\\w-]+)`))?.[1]

async function login(email: string, password: string) {
  return await fetch(`${inject('baseUrl')}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...fromIp().headers },
    body: JSON.stringify({ email, password })
  })
}

async function createFiche(email: string, name = 'Paul Martin') {
  const response = await api(alice, 'POST', '/api/participants', { name, email, gameIds: [world.a.game.id] })
  expect(response.status, JSON.stringify(response.body)).toBe(200)
  return bodyOf<{ id: string, updatedAt: string, heldByPerson: boolean, name: string }>(response)
}

describe('compte pré-créé (US-244)', () => {
  it('créer une fiche à une adresse sans compte pré-crée un compte non activé, sans email', async () => {
    const email = unique('paul')
    const sent = smtp.received.length
    const fiche = await createFiche(email.toUpperCase())

    const account = await prisma.user.findUniqueOrThrow({ where: { email } })
    expect(account).toMatchObject({ name: '', password: null, emailConfirmedAt: null, termsAcceptedVersion: null })
    expect((await prisma.participant.findUniqueOrThrow({ where: { id: fiche.id } })).userId).toBe(account.id)
    expect(fiche).toMatchObject({ heldByPerson: false })
    expect(sentTo(email, sent)).toEqual([])
  })

  it('une deuxième fiche ailleurs rejoint la première, sur le même compte', async () => {
    const email = unique('partagee')
    await createFiche(email)
    const response = await api(bob, 'POST', '/api/participants', { name: 'Chez Bob', email, gameIds: [world.b.game.id] })
    expect(response.status).toBe(200)
    expect(await prisma.user.count({ where: { email } })).toBe(1)
    expect(await prisma.participant.count({ where: { email } })).toBe(1)
  })

  it('donner une nouvelle adresse à une fiche la rattache au compte, pré-créé, de cette adresse', async () => {
    const fiche = await createFiche(unique('avant'))
    const after = unique('apres')
    const current = await api(alice, 'GET', `/api/participants/${fiche.id}`)
    const response = await api(alice, 'PUT', `/api/participants/${fiche.id}`, {
      name: 'Paul Martin', email: after, gameIds: [world.a.game.id], updatedAt: bodyOf<{ updatedAt: string }>(current).updatedAt
    })
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    const account = await prisma.user.findUniqueOrThrow({ where: { email: after } })
    expect(account.password).toBeNull()
    expect((await prisma.participant.findUniqueOrThrow({ where: { id: fiche.id } })).userId).toBe(account.id)
  })

  it('on ne se connecte pas à un compte non activé', async () => {
    const email = unique('inactif')
    await createFiche(email)
    const response = await login(email, randomUUID())
    expect(response.status).toBe(401)
    expect((await response.json()).message).toBe('Email ou mot de passe incorrect')
  })

  it('l’équipe modifie le nom et le téléphone d’une fiche au compte non activé', async () => {
    const email = unique('modifiable')
    const fiche = await createFiche(email)
    const response = await api(alice, 'PUT', `/api/participants/${fiche.id}`, {
      name: 'Paul Renommé', email, phone: '0611223344', gameIds: [world.a.game.id], updatedAt: fiche.updatedAt
    })
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(response.body).toMatchObject({ name: 'Paul Renommé', phone: '0611223344', heldByPerson: false })
  })

  it('une fiche rattachée à un compte activé reste tenue par la personne', async () => {
    const email = unique('activee')
    await prisma.user.create({ data: { email, name: 'Personne Active', password: await someHash(), phone: '0700000000', profileUpdatedAt: new Date() } })
    const fiche = await createFiche(email, 'Nom saisi')
    expect(fiche).toMatchObject({ heldByPerson: true, name: 'Personne Active' })
  })

  it('le refus de photo d’une fiche au compte non activé se lève par l’équipe', async () => {
    const fiche = await createFiche(unique('photo'))
    expect((await api(alice, 'POST', `/api/participants/${fiche.id}/photo-refusal`, { refused: true })).status).toBe(200)
    expect((await api(alice, 'POST', `/api/participants/${fiche.id}/photo-refusal`, { refused: false })).status).toBe(200)
  })
})

describe('inscription libre jamais confirmée (US-244)', () => {
  const eightDaysAgo = () => new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)

  it('avec une fiche, le compte redevient pré-créé sans rien de l’inscription ; sans fiche, il disparaît', async () => {
    const withFiche = unique('avec-fiche')
    await createFiche(withFiche)
    await prisma.user.update({
      where: { email: withFiche },
      data: { name: 'Nom d’un tiers', password: await someHash(), termsAcceptedVersion: '2026-01-01', termsAcceptedAt: new Date(), createdAt: eightDaysAgo() }
    })
    const alone = await prisma.user.create({ data: { email: unique('seule'), name: 'Seule', password: await someHash(), emailConfirmedAt: null, createdAt: eightDaysAgo() } })
    const preCreatedAlone = await prisma.user.create({ data: { email: unique('sans-fiche'), name: '', password: null, emailConfirmedAt: null, createdAt: eightDaysAgo() } })

    await login(unique('declencheur'), 'x')

    expect(await prisma.user.findUniqueOrThrow({ where: { email: withFiche } })).toMatchObject({ name: '', password: null, termsAcceptedVersion: null, termsAcceptedAt: null })
    expect(await prisma.participant.count({ where: { email: withFiche, userId: { not: null } } })).toBe(1)
    expect(await prisma.user.findUnique({ where: { id: alone.id } })).toBeNull()
    expect(await prisma.user.findUnique({ where: { id: preCreatedAlone.id } })).toBeNull()
  })
})

describe('adresse d’un compte non activé reprise (US-244)', () => {
  it('une personne activée prend cette adresse : les deux fiches se réunissent, le compte non activé disparaît', async () => {
    const password = randomUUID()
    const ownEmail = unique('activee')
    const user = await prisma.user.create({ data: { email: ownEmail, name: 'Camille', password: await bcrypt.hash(password, 4) } })
    // Sa fiche chez Bob, à son adresse de compte ; une autre chez Alice, à une adresse qu'Alice connaît
    await api(bob, 'POST', '/api/participants', { name: 'Camille chez Bob', email: ownEmail, gameIds: [world.b.game.id] })
    const otherEmail = unique('autre-adresse')
    await createFiche(otherEmail, 'Camille chez Alice')
    const preCreated = await prisma.user.findUniqueOrThrow({ where: { email: otherEmail } })

    const sent = smtp.received.length
    const request = await api(user, 'POST', '/api/account/email', { email: otherEmail, password })
    expect(request.status, JSON.stringify(request.body)).toBe(200)
    const message = sentTo(otherEmail, sent)[0]!
    expect((await api(null, 'POST', '/api/auth/confirm', { token: linkIn(message, 'acces/confirmer') })).status).toBe(200)

    expect(await prisma.user.findUnique({ where: { id: preCreated.id } })).toBeNull()
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe(otherEmail)
    const fiches = await prisma.participant.findMany({ where: { userId: user.id }, include: { gameLinks: true } })
    expect(fiches).toHaveLength(1)
    expect(fiches[0]!.email).toBe(otherEmail)
    expect(fiches[0]!.gameLinks.map((link) => link.gameId).sort()).toEqual([world.a.game.id, world.b.game.id].sort())
    expect(await prisma.participant.count({ where: { email: ownEmail } })).toBe(0)
  })

  it('l’adresse d’un compte activé reste refusée', async () => {
    const password = randomUUID()
    const user = await prisma.user.create({ data: { email: unique('demandeuse'), name: 'D', password: await bcrypt.hash(password, 4) } })
    const taken = await prisma.user.create({ data: { email: unique('prise'), name: 'P', password: await someHash() } })
    expect((await api(user, 'POST', '/api/account/email', { email: taken.email, password })).status).toBe(409)
  })

  it('l’administratrice reprend un compte non activé : nom et rôle saisis, fiche gardée, lien de mot de passe', async () => {
    const email = unique('reprise')
    const fiche = await createFiche(email)
    const preCreated = await prisma.user.findUniqueOrThrow({ where: { email } })
    await prisma.accountToken.create({ data: { userId: preCreated.id, kind: 'confirm', tokenHash: `ancien-${counter}`, passwordHash: await someHash(), expiresAt: new Date(Date.now() + 3_600_000) } })

    const sent = smtp.received.length
    const response = await api(admin, 'POST', '/api/admin/users', { email, name: 'Reprise' })
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(response.body).toMatchObject({ id: preCreated.id, name: 'Reprise' })
    const account = await prisma.user.findUniqueOrThrow({ where: { id: preCreated.id } })
    expect(account.emailConfirmedAt).not.toBeNull()
    expect(await prisma.accountToken.count({ where: { userId: account.id, tokenHash: { startsWith: 'ancien-' } } })).toBe(0)
    expect((await prisma.participant.findUniqueOrThrow({ where: { id: fiche.id } })).userId).toBe(account.id)
    expect(linkIn(sentTo(email, sent)[0]!, 'acces/mot-de-passe')).toBeTruthy()

    // Un compte activé reste refusé
    expect((await api(admin, 'POST', '/api/admin/users', { email, name: 'Encore' })).status).toBe(409)
  })

  it('la liste de l’administration ne renvoie les comptes non activés que sur demande, et leur nombre sinon (US-248)', async () => {
    const email = unique('liste-admin')
    await createFiche(email)
    const byDefault = await api(admin, 'GET', '/api/admin/users')
    const body = byDefault.body as { users: Array<{ email: string }>, inactiveCount: number }
    expect(body.users.map((user) => user.email)).not.toContain(email)
    expect(body.inactiveCount).toBeGreaterThan(0)
    const all = (await api(admin, 'GET', '/api/admin/users?inactifs=1')).body as { users: Array<{ email: string }> }
    expect(all.users.map((user) => user.email)).toContain(email)
  })

  it('l’administratrice ne touche pas non plus à une inscription jamais confirmée (US-248)', async () => {
    const pending = await prisma.user.create({ data: { email: unique('inscription-en-cours'), name: 'En cours', password: await someHash(), emailConfirmedAt: null } })
    for (const [method, path, body] of [['POST', `/api/admin/users/${pending.id}/password-link`, undefined], ['PUT', `/api/admin/users/${pending.id}`, { name: 'Autre' }], ['DELETE', `/api/admin/users/${pending.id}`, undefined]] as const) {
      const response = await api(admin, method, path, body)
      expect(response.status).toBe(400)
      expect(JSON.stringify(response.body)).toContain('n’est pas activé')
    }
    expect(await prisma.user.findUniqueOrThrow({ where: { id: pending.id } })).toMatchObject({ name: 'En cours' })
  })

  it('l’administratrice n’active pas un compte pré-créé par un simple lien, et ne le supprime pas sous ses fiches', async () => {
    const email = unique('administree')
    await createFiche(email)
    const preCreated = await prisma.user.findUniqueOrThrow({ where: { email } })
    const sent = smtp.received.length
    const link = await api(admin, 'POST', `/api/admin/users/${preCreated.id}/password-link`)
    expect(link.status).toBe(400)
    expect(JSON.stringify(link.body)).toContain('n’est pas activé')
    expect(sentTo(email, sent)).toEqual([])

    const updated = await api(admin, 'PUT', `/api/admin/users/${preCreated.id}`, { name: 'Renommé', email: unique('ailleurs'), role: 'user' })
    expect(updated.status).toBe(400)
    expect(await prisma.user.findUniqueOrThrow({ where: { id: preCreated.id } })).toMatchObject({ email, name: '' })

    const deleted = await api(admin, 'DELETE', `/api/admin/users/${preCreated.id}`)
    expect(deleted.status).toBe(400)
    expect(await prisma.user.count({ where: { id: preCreated.id } })).toBe(1)
  })
})

describe('compte non activé effacé avec sa dernière fiche (US-249, ADR-0090)', () => {
  const accountOf = (email: string) => prisma.user.findUnique({ where: { email } })

  it('la dernière équipe qui efface la fiche efface aussi le compte ; avant, il reste pour l’autre équipe', async () => {
    const email = unique('suivie-par-deux')
    const fiche = await createFiche(email)
    expect((await api(bob, 'POST', '/api/participants', { name: 'Chez Bob', email, gameIds: [world.b.game.id] })).status).toBe(200)

    expect((await api(alice, 'DELETE', `/api/participants/${fiche.id}`)).status).toBe(200)
    expect(await prisma.participant.findUnique({ where: { id: fiche.id } })).not.toBeNull()
    expect(await accountOf(email)).not.toBeNull()

    expect((await api(bob, 'DELETE', `/api/participants/${fiche.id}`)).status).toBe(200)
    expect(await prisma.participant.findUnique({ where: { id: fiche.id } })).toBeNull()
    expect(await accountOf(email)).toBeNull()
  })

  it('retirer la fiche de son dernier jeu efface aussi le compte', async () => {
    const email = unique('dernier-jeu')
    const fiche = await createFiche(email)
    const response = await api(alice, 'PUT', `/api/participants/${fiche.id}`, { name: 'Paul Martin', email, gameIds: [], updatedAt: fiche.updatedAt })
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(await accountOf(email)).toBeNull()
  })

  it('corriger l’adresse d’une fiche qu’on est seule à suivre efface le compte de l’ancienne adresse', async () => {
    const wrong = unique('faute-de-frappe')
    const right = unique('bonne-adresse')
    const fiche = await createFiche(wrong)
    // Une fiche existe déjà à la bonne adresse, chez Bob : tous les jeux d'Alice la rejoignent
    expect((await api(bob, 'POST', '/api/participants', { name: 'Chez Bob', email: right, gameIds: [world.b.game.id] })).status).toBe(200)
    const response = await api(alice, 'PUT', `/api/participants/${fiche.id}`, { name: 'Paul Martin', email: right, gameIds: [world.a.game.id], updatedAt: fiche.updatedAt })
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(await prisma.participant.findUnique({ where: { id: fiche.id } })).toBeNull()
    expect(await accountOf(wrong)).toBeNull()
    expect(await accountOf(right)).not.toBeNull()
  })

  it('un compte dont une inscription attend sa confirmation reste quand sa fiche est effacée (revue de la PR #247)', async () => {
    const email = unique('inscription-en-attente')
    const fiche = await createFiche(email)
    const signup = await api(null, 'POST', '/api/auth/signup', { name: 'Paul Inscrit', email, password: randomUUID(), termsAccepted: true }, fromIp())
    expect(signup.status).toBe(200)
    expect((await api(alice, 'DELETE', `/api/participants/${fiche.id}`)).status).toBe(200)
    expect(await accountOf(email)).not.toBeNull()
  })

  it('un compte activé reste quand sa fiche est effacée', async () => {
    const email = unique('activee-gardee')
    await prisma.user.create({ data: { email, name: 'Activée', password: await someHash() } })
    const fiche = await createFiche(email)
    expect((await api(alice, 'DELETE', `/api/participants/${fiche.id}`)).status).toBe(200)
    expect(await accountOf(email)).not.toBeNull()
  })
})
