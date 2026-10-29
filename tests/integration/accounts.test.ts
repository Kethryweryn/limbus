// EPIC-013 : inscription libre, confirmation, mot de passe, compte en libre-service, comptes gérés par l'administratrice,
// invitation par la bonne adresse, plafond de stockage, transfert prévenu par email
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { api, tokenFor, type TestUser } from './api'
import { createTestPrisma } from './db'
import { startTestSmtp, type ReceivedEmail } from './smtp'

const prisma = createTestPrisma()
const { admin } = inject('world').users
let smtp: Awaited<ReturnType<typeof startTestSmtp>>
let counter = 0

beforeAll(async () => {
  smtp = await startTestSmtp(prisma)
})

afterAll(async () => {
  await smtp.stop()
  await prisma.$disconnect()
})

// Une IP par appel : les limites par IP des routes publiques ne se gênent pas d'un test à l'autre
const fromIp = () => ({ headers: { 'x-forwarded-for': `10.13.${Math.floor(++counter / 250)}.${counter % 250}` } })
const unique = (name: string) => `${name}-${++counter}@example.test`

async function lastEmailTo(email: string, since: number): Promise<ReceivedEmail> {
  const message = smtp.received.slice(since).find((received) => received.to.includes(email))
  expect(message, `aucun email reçu par ${email}`).toBeDefined()
  return message!
}
const linkIn = (message: ReceivedEmail, path: string) => message.text.match(new RegExp(`/${path}/([\\w-]+)`))?.[1]

// Connexion par le formulaire : le cookie renvoyé porte l'identifiant et la version de session
async function login(email: string, password: string) {
  return await fetch(`${inject('baseUrl')}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...fromIp().headers },
    body: JSON.stringify({ email, password })
  })
}

function createUser(key: string, data: Record<string, unknown> = {}) {
  return prisma.user.create({ data: { email: unique(key), name: key, password: 'non-utilise', ...data } })
}

async function signup(email: string, extra: Record<string, unknown> = {}) {
  return await api(null, 'POST', '/api/auth/signup', { name: 'Nouvelle', email, password: 'mot-de-passe-solide', ...extra }, fromIp())
}

describe('inscription libre et confirmation (US-061)', () => {
  it('l’écran de connexion sait que l’inscription est ouverte', async () => {
    expect((await api(null, 'GET', '/api/auth/signup')).body).toEqual({ open: true })
  })

  it('le compte ne permet rien avant la confirmation, puis le lien le confirme et le connecte', async () => {
    const email = unique('inscrite')
    const sent = smtp.received.length
    expect((await signup(email)).status).toBe(200)
    const user = await prisma.user.findUniqueOrThrow({ where: { email } })
    expect(user.emailConfirmedAt).toBeNull()

    // Connectée mais bloquée : seuls « me » et le renvoi du lien répondent
    expect((await login(email, 'mot-de-passe-solide')).status).toBe(200)
    expect((await api(user, 'GET', '/api/games')).status).toBe(403)
    expect((await api(user, 'GET', '/api/auth/me')).body).toMatchObject({ authenticated: true, user: { emailConfirmed: false } })
    expect((await api(user, 'POST', '/api/auth/resend-confirmation')).status).toBe(200)

    // Le premier lien a été remplacé par le renvoi
    const first = linkIn(await lastEmailTo(email, sent), 'acces/confirmer')!
    const messages = smtp.received.slice(sent).filter((received) => received.to.includes(email))
    const latest = linkIn(messages.at(-1)!, 'acces/confirmer')!
    expect((await api(null, 'POST', '/api/auth/confirm', { token: first })).status).toBe(400)

    const confirmed = await api(null, 'POST', '/api/auth/confirm', { token: latest })
    expect(confirmed.status).toBe(200)
    expect((await api(user, 'GET', '/api/games')).status).toBe(200)
    // Usage unique
    expect((await api(null, 'POST', '/api/auth/confirm', { token: latest })).status).toBe(400)
  })

  it('une adresse déjà prise reçoit la même réponse, et un email qui le dit', async () => {
    const existing = await createUser('deja-la')
    const sent = smtp.received.length
    expect((await signup(existing.email)).status).toBe(200)
    expect((await lastEmailTo(existing.email, sent)).text).toContain('qui en a déjà un')
    expect((await prisma.user.findUniqueOrThrow({ where: { id: existing.id } })).name).toBe('deja-la')
  })

  it('une inscription faite avant la vraie personne ne lui impose pas son mot de passe', async () => {
    const email = unique('convoitee')
    const sent = smtp.received.length
    await signup(email, { password: 'mot-de-passe-du-tiers' })
    await signup(email, { password: 'mot-de-passe-de-la-vraie' })
    const links = smtp.received.slice(sent).filter((received) => received.to.includes(email)).map((received) => linkIn(received, 'acces/confirmer')!)
    expect(links).toHaveLength(2)

    // La vraie personne ouvre le lien de son inscription
    expect((await api(null, 'POST', '/api/auth/confirm', { token: links[1] })).status).toBe(200)
    expect((await login(email, 'mot-de-passe-du-tiers')).status).toBe(401)
    expect((await login(email, 'mot-de-passe-de-la-vraie')).status).toBe(200)
    // L'autre lien ne sert plus
    expect((await api(null, 'POST', '/api/auth/confirm', { token: links[0] })).status).toBe(400)
  })

  it('le champ piège fait semblant de réussir sans rien créer', async () => {
    const email = unique('robot')
    expect((await signup(email, { website: 'http://spam.example' })).status).toBe(200)
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull()
  })

  it('limite les inscriptions par adresse IP', async () => {
    const headers = { 'x-forwarded-for': '10.99.0.1' }
    const statuses = []
    for (let index = 0; index < 6; index += 1) {
      statuses.push((await api(null, 'POST', '/api/auth/signup', { name: 'N', email: unique('serie'), password: 'mot-de-passe-solide' }, { headers })).status)
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429])
  })

  it('un compte jamais confirmé disparaît au bout de 7 jours', async () => {
    const old = await createUser('oubliee', { emailConfirmedAt: null, createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) })
    const recent = await createUser('recente', { emailConfirmedAt: null })
    await signup(unique('declencheur'))
    expect(await prisma.user.findUnique({ where: { id: old.id } })).toBeNull()
    expect(await prisma.user.findUnique({ where: { id: recent.id } })).not.toBeNull()
  })

  it('refuse l’inscription quand l’envoi d’emails est désactivé', async () => {
    await smtp.disable()
    try {
      expect((await signup(unique('sans-smtp'))).status).toBe(503)
    } finally {
      await smtp.enable()
    }
  })
})

describe('mot de passe oublié (US-062)', () => {
  it('même réponse pour une adresse inconnue, sans email', async () => {
    const email = unique('inconnue')
    const sent = smtp.received.length
    expect((await api(null, 'POST', '/api/auth/password-forgotten', { email }, fromIp())).status).toBe(200)
    expect(smtp.received.slice(sent).some((received) => received.to.includes(email))).toBe(false)
  })

  it('le lien reçu change le mot de passe, déconnecte les autres appareils et ne sert qu’une fois', async () => {
    const user = await createUser('oublieuse')
    const sent = smtp.received.length
    expect((await api(null, 'POST', '/api/auth/password-forgotten', { email: user.email }, fromIp())).status).toBe(200)
    const token = linkIn(await lastEmailTo(user.email, sent), 'acces/mot-de-passe')!

    const reset = await api(null, 'POST', '/api/auth/password-reset', { token, password: 'nouveau-mot-de-passe' })
    expect(reset.status).toBe(200)
    expect((await api(user, 'GET', '/api/games')).status).toBe(401)
    expect((await login(user.email, 'nouveau-mot-de-passe')).status).toBe(200)
    expect((await api(null, 'POST', '/api/auth/password-reset', { token, password: 'encore-un-autre' })).status).toBe(400)
  })
})

describe('mon compte (US-063)', () => {
  it('change le nom', async () => {
    const user = await createUser('nommee')
    expect((await api(user, 'PUT', '/api/account', { name: 'Nouveau nom' })).status).toBe(200)
    expect((await api(user, 'GET', '/api/account')).body).toMatchObject({ name: 'Nouveau nom', email: user.email })
  })

  it('change l’email après confirmation de la nouvelle adresse, et prévient l’ancienne', async () => {
    const password = 'mot-de-passe-actuel'
    const user = await createUser('demenage')
    await prisma.user.update({ where: { id: user.id }, data: { password: await import('bcrypt').then((bcrypt) => bcrypt.hash(password, 4)) } })
    const newEmail = unique('nouvelle-adresse')

    expect((await api(user, 'POST', '/api/account/email', { email: newEmail, password: 'faux' })).status).toBe(400)
    const sent = smtp.received.length
    expect((await api(user, 'POST', '/api/account/email', { email: newEmail, password })).status).toBe(200)
    expect((await api(user, 'GET', '/api/account')).body).toMatchObject({ email: user.email, pendingEmail: newEmail })

    const token = linkIn(await lastEmailTo(newEmail, sent), 'acces/confirmer')!
    expect((await api(null, 'POST', '/api/auth/confirm', { token })).body).toMatchObject({ email: newEmail })
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe(newEmail)
    expect((await lastEmailTo(user.email, sent)).text).toContain(newEmail)
  })

  it('refuse une nouvelle adresse prise entre la demande et la confirmation', async () => {
    const password = 'mot-de-passe-actuel'
    const user = await createUser('devancee', { password: await import('bcrypt').then((bcrypt) => bcrypt.hash(password, 4)) })
    const newEmail = unique('convoitee')
    const sent = smtp.received.length
    await api(user, 'POST', '/api/account/email', { email: newEmail, password })
    const token = linkIn(await lastEmailTo(newEmail, sent), 'acces/confirmer')!
    await prisma.user.create({ data: { email: newEmail, name: 'Plus rapide', password: 'non-utilise' } })
    expect((await api(null, 'POST', '/api/auth/confirm', { token })).status).toBe(409)
  })

  it('change le mot de passe avec l’ancien ; les autres appareils sont déconnectés', async () => {
    const password = 'mot-de-passe-actuel'
    const user = await createUser('prudente', { password: await import('bcrypt').then((bcrypt) => bcrypt.hash(password, 4)) })
    expect((await api(user, 'PUT', '/api/account/password', { currentPassword: 'faux', password: 'mot-de-passe-neuf' })).status).toBe(400)
    expect((await api(user, 'PUT', '/api/account/password', { currentPassword: password, password: 'mot-de-passe-neuf' })).status).toBe(200)
    expect((await api(user, 'GET', '/api/games')).status).toBe(401)
    expect((await login(user.email, 'mot-de-passe-neuf')).status).toBe(200)
  })
})

describe('invitation par la bonne adresse (US-064)', () => {
  async function invitation() {
    const owner = await createUser('proprietaire')
    const game = await prisma.game.create({ data: { title: `Jeu ${counter}`, slug: `jeu-invitation-${++counter}`, description: '', ownerId: owner.id } })
    const email = unique('invitee')
    const sent = smtp.received.length
    expect((await api(owner, 'POST', `/api/games/${game.id}/invitations`, { email })).status).toBe(200)
    return { game, email, token: linkIn(await lastEmailTo(email, sent), 'invitations')! }
  }

  it('un autre compte connecté ne l’accepte pas ; le compte de l’adresse invitée, si', async () => {
    const { game, email, token } = await invitation()
    const other = await createUser('autre')
    const refused = await api(other, 'POST', '/api/invitations/accept', { token })
    expect(refused.status).toBe(403)
    expect(refused.body).toMatchObject({ data: { wrongAccount: true } })

    const invited = await prisma.user.create({ data: { email, name: 'Invitée', password: 'non-utilise' } })
    expect((await api(invited, 'POST', '/api/invitations/accept', { token })).status).toBe(200)
    expect(await prisma.gameShare.count({ where: { gameId: game.id, userId: invited.id } })).toBe(1)
  })

  it('le compte créé depuis l’invitation prend l’adresse invitée, confirmée d’emblée', async () => {
    const { email, token } = await invitation()
    const response = await api(null, 'POST', '/api/auth/register', { token, email: unique('ailleurs'), name: 'Invitée', password: 'mot-de-passe-solide' })
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    const user = await prisma.user.findUniqueOrThrow({ where: { email } })
    expect(user.emailConfirmedAt).not.toBeNull()
  })
})

describe('comptes gérés par l’administratrice (US-065)', () => {
  it('crée un compte sans mot de passe : la personne le choisit par le lien reçu', async () => {
    const email = unique('creee')
    const sent = smtp.received.length
    const created = await api(admin, 'POST', '/api/admin/users', { email: email.toUpperCase(), name: 'Créée' })
    expect(created.status).toBe(200)
    expect(created.body).toMatchObject({ email })
    const token = linkIn(await lastEmailTo(email, sent), 'acces/mot-de-passe')!
    expect((await api(null, 'POST', '/api/auth/password-reset', { token, password: 'choisi-par-elle' })).status).toBe(200)
    expect((await login(email, 'choisi-par-elle')).status).toBe(200)
  })

  it('renvoie un lien de mot de passe à un compte existant', async () => {
    const user = await createUser('relancee')
    const sent = smtp.received.length
    expect((await api(admin, 'POST', `/api/admin/users/${user.id}/password-link`)).status).toBe(200)
    expect(linkIn(await lastEmailTo(user.email, sent), 'acces/mot-de-passe')).toBeTruthy()
  })

  it('désactiver déconnecte et bloque la connexion ; réactiver rétablit', async () => {
    const password = 'mot-de-passe-actuel'
    const user = await createUser('suspendue', { password: await import('bcrypt').then((bcrypt) => bcrypt.hash(password, 4)) })
    expect((await api(admin, 'PUT', `/api/admin/users/${user.id}`, { disabled: true })).status).toBe(200)
    expect((await api(user, 'GET', '/api/games')).status).toBe(401)
    expect((await login(user.email, password)).status).toBe(403)

    const sent = smtp.received.length
    await api(null, 'POST', '/api/auth/password-forgotten', { email: user.email }, fromIp())
    expect(smtp.received.slice(sent).some((received) => received.to.includes(user.email))).toBe(false)
    expect((await api(admin, 'POST', `/api/admin/users/${user.id}/password-link`)).status).toBe(400)

    expect((await api(admin, 'PUT', `/api/admin/users/${user.id}`, { disabled: false })).status).toBe(200)
    expect((await login(user.email, password)).status).toBe(200)
  })

  it('l’administratrice ne se désactive pas elle-même', async () => {
    expect((await api(admin, 'PUT', `/api/admin/users/${admin.id}`, { disabled: true })).status).toBe(400)
  })
})

describe('plafond de stockage (US-066)', () => {
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array(200).fill(0)])

  async function uploadPhoto(user: TestUser, gameId: string) {
    const form = new FormData()
    form.append('photo', new Blob([PNG], { type: 'image/png' }), 'photo.png')
    form.append('gameId', gameId)
    const response = await fetch(`${inject('baseUrl')}/api/uploads/session-assignment-photos`, {
      method: 'POST',
      headers: { cookie: `limbus_token=${tokenFor(user)}` },
      body: form
    })
    return { status: response.status, body: await response.json() }
  }

  it('les fichiers comptent pour la propriétaire, même téléversés par une co-organisatrice', async () => {
    const owner = await createUser('stockeuse', { storageQuotaMb: 0 })
    const coOrga = await createUser('co-stockeuse')
    const game = await prisma.game.create({
      data: { title: 'Jeu plein', slug: `jeu-plein-${++counter}`, description: '', ownerId: owner.id, shares: { create: { userId: coOrga.id } } }
    })

    const refused = await uploadPhoto(coOrga, game.id)
    expect(refused.status).toBe(413)
    expect(refused.body.message).toContain('propriétaire du jeu')

    await prisma.user.update({ where: { id: owner.id }, data: { storageQuotaMb: 1 } })
    expect((await uploadPhoto(coOrga, game.id)).status).toBe(200)
    expect((await api(owner, 'GET', '/api/account')).body).toMatchObject({ storage: { usedBytes: PNG.length, quotaBytes: 1024 * 1024 } })
    // Rien pour la co-organisatrice
    expect((await api(coOrga, 'GET', '/api/account')).body).toMatchObject({ storage: { usedBytes: 0 } })
  })
})

describe('transfert prévenu (US-068)', () => {
  it('la destinataire reçoit un email et voit « Transfert proposé » dans sa liste', async () => {
    const owner = await createUser('donneuse')
    const coOrga = await createUser('receveuse')
    const game = await prisma.game.create({
      data: { title: 'Jeu donné', slug: `jeu-donne-${++counter}`, description: '', ownerId: owner.id, shares: { create: { userId: coOrga.id } } }
    })
    const sent = smtp.received.length
    expect((await api(owner, 'POST', `/api/games/${game.id}/transfer`, { userId: coOrga.id })).body).toMatchObject({ emailSent: true })
    expect((await lastEmailTo(coOrga.email, sent)).text).toContain(`/games/${game.slug}`)

    const games = (await api(coOrga, 'GET', '/api/games')).body as Array<{ id: string, transferProposedToMe: boolean }>
    expect(games.find((item) => item.id === game.id)).toMatchObject({ transferProposedToMe: true })
    const ownerGames = (await api(owner, 'GET', '/api/games')).body as Array<{ id: string, transferProposedToMe: boolean }>
    expect(ownerGames.find((item) => item.id === game.id)).toMatchObject({ transferProposedToMe: false })
  })
})
