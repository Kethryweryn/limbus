// US-004 : répondre à une invitation par son lien personnel (SPEC-001, R8, R13, R14, R16, R20, R22)
import { createHash, randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { api } from './api'
import { createTestPrisma } from './db'
import { personalLinkToken, startTestSmtp } from './smtp'

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

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

// Chaque test parle depuis sa propre IP (le proxy local de confiance relaie X-Forwarded-For) :
// la limite de débit par IP ne mélange pas les tests
async function publicApi(method: string, path: string, body?: unknown, ip = `10.4.0.${counter}`) {
  const headers: Record<string, string> = { 'x-forwarded-for': ip }
  if (body !== undefined) headers['content-type'] = 'application/json'
  const response = await fetch(`${inject('baseUrl')}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const text = await response.text()
  let parsed: unknown = text
  try { parsed = JSON.parse(text) } catch { /* texte brut */ }
  return { status: response.status, body: parsed as any, headers: response.headers }
}

// Une invitation d'Alice, avec un jeton connu du test
async function invitation(options: { periodState?: string, closesAt?: Date, responseDueAt?: Date, sessionDate?: Date } = {}) {
  const key = `reponse-${++counter}`
  const game = await prisma.game.create({
    data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId: alice.id, noteIntention: `Note d’intention ${key}` }
  })
  const location = await prisma.location.create({ data: { name: 'Château', slug: `chateau-${key}`, address: '1 rue du Donjon', gameId: game.id } })
  const session = await prisma.session.create({
    data: { name: `Session ${key}`, slug: `session-${key}`, gameId: game.id, locationId: location.id, date: options.sessionDate ?? new Date('2099-03-10T09:00:00Z') }
  })
  const period = await prisma.registrationPeriod.create({
    data: {
      name: `Période ${key}`,
      gameId: game.id,
      publicId: `pub-${key}`,
      state: options.periodState ?? 'open',
      closesAt: options.closesAt,
      sessions: { create: { sessionId: session.id, seats: 5 } }
    }
  })
  const participant = await prisma.participant.create({
    data: { name: `Camille ${key}`, slug: `camille-${key}`, email: `camille-${key}@example.test`, phone: '0100000000', gameLinks: { create: { gameId: game.id } } }
  })
  const token = randomBytes(32).toString('base64url')
  const registration = await prisma.registration.create({
    data: {
      periodId: period.id,
      sessionId: session.id,
      participantId: participant.id,
      status: 'invited',
      source: 'invitation',
      invitedById: alice.id,
      email: participant.email!,
      tokenHash: sha256(token),
      responseDueAt: options.responseDueAt ?? new Date(Date.now() + 7 * 86_400_000)
    }
  })
  return { key, game, session, period, participant, registration, token, path: `/api/public/registrations/${token}` }
}

function answers(extra: Record<string, unknown> = {}) {
  return {
    email: 'Camille.Perso@Example.test',
    firstName: 'Camille',
    lastName: 'Martin',
    phone: '0612345678',
    emergencyContactName: 'Dominique',
    emergencyContactPhone: '0698765432',
    dietary: 'Arachides',
    healthConsent: true,
    charterAccepted: true,
    ...extra
  }
}

describe('consulter son invitation', () => {
  it('montre le jeu, la session, la note d’intention et le formulaire prérempli', async () => {
    const { key, path, game, session } = await invitation()

    const response = await publicApi('GET', path)

    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(response.body).toMatchObject({
      status: 'invited',
      game: { title: game.title, noteIntention: game.noteIntention },
      session: { name: session.name, location: { name: 'Château', address: '1 rue du Donjon' } },
      periodState: 'open',
      overdue: false,
      canAccept: true,
      canDecline: true,
      canEdit: false,
      definition: { standardFields: { phone: { asked: true, required: true } } },
      answers: { email: `camille-${key}@example.test`, firstName: 'Camille', lastName: key, phone: null }
    })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
  })

  it('ne montre rien des autres inscrits de la période', async () => {
    const { path, period, session, game } = await invitation()
    const other = await prisma.participant.create({
      data: { name: 'Autre Inscrite', slug: `autre-inscrite-${counter}`, email: 'autre-inscrite@example.test', gameLinks: { create: { gameId: game.id } } }
    })
    await prisma.registration.create({
      data: { periodId: period.id, sessionId: session.id, participantId: other.id, status: 'confirmed', source: 'invitation', email: other.email!, phone: '0699999999' }
    })

    const response = await publicApi('GET', path)
    expect(response.status).toBe(200)
    const body = JSON.stringify(response.body)
    expect(body).not.toContain('Autre Inscrite')
    expect(body).not.toContain('autre-inscrite@example.test')
    expect(body).not.toContain('tokenHash')
  })

  it('la page du lien n’envoie pas de Referer et n’est pas mise en cache', async () => {
    const { token } = await invitation()
    const response = await fetch(`${inject('baseUrl')}/inscription/${token}`)
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})

describe('accepter', () => {
  it('confirme l’inscription, crée la participation de session et envoie la confirmation (R16, R22)', async () => {
    const { path, token, registration, participant, session, game } = await invitation()

    const response = await publicApi('PUT', path, answers())

    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(response.body).toMatchObject({ status: 'confirmed', canAccept: false, canEdit: true, emailSent: true })

    const saved = await prisma.registration.findUniqueOrThrow({ where: { id: registration.id }, include: { formVersion: true } })
    expect(saved).toMatchObject({
      status: 'confirmed',
      email: 'camille.perso@example.test',
      lastName: 'Martin',
      phone: '0612345678',
      emergencyContactName: 'Dominique',
      dietary: 'Arachides'
    })
    expect(saved.confirmedAt).not.toBeNull()
    expect(saved.respondedAt).not.toBeNull()
    expect(saved.charterAcceptedAt).not.toBeNull()
    expect(saved.healthConsentAt).not.toBeNull()
    // Sans formulaire enregistré, la définition par défaut devient la version 1, gardée par l'inscription
    expect(saved.formVersion?.number).toBe(1)

    expect(await prisma.sessionParticipant.count({ where: { sessionId: session.id, participantId: participant.id, role: 'participant' } })).toBe(1)
    // L'email du formulaire fait foi et remonte sur la fiche (R12) ; le reste reste sur l'inscription (R14)
    expect(await prisma.participant.findUniqueOrThrow({ where: { id: participant.id } })).toMatchObject({ email: 'camille.perso@example.test', phone: '0100000000' })

    const email = smtp.received.find((message) => message.to.includes('camille.perso@example.test'))!
    expect(email.text).toContain(game.title)
    expect(personalLinkToken(email)).toBe(token)
    expect(email.text).not.toContain('Arachides')
  })

  it('refuse un formulaire incomplet, sans rien enregistrer', async () => {
    const { path, registration } = await invitation()

    const response = await publicApi('PUT', path, answers({ phone: '', charterAccepted: false }))

    expect(response.status).toBe(400)
    expect(response.body.data.data.map((issue: { path: string }) => issue.path).sort()).toEqual(['charterAccepted', 'phone'])
    expect(await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })).toMatchObject({ status: 'invited', phone: null })
  })

  it('exige le consentement santé quand des allergies sont déclarées (R14)', async () => {
    const { path } = await invitation()
    const response = await publicApi('PUT', path, answers({ healthConsent: false }))
    expect(response.status).toBe(400)
    expect(response.body.data.data[0].path).toBe('healthConsent')
  })

  it('reste possible après l’échéance, qui est signalée (R20)', async () => {
    const { path } = await invitation({ responseDueAt: new Date(Date.now() - 86_400_000) })

    expect((await publicApi('GET', path)).body).toMatchObject({ overdue: true, canAccept: true })
    expect((await publicApi('PUT', path, answers())).status).toBe(200)
  })

  it('reste possible après la clôture, tant que la place n’est pas libérée (R13)', async () => {
    const { path } = await invitation({ periodState: 'closed' })
    const response = await publicApi('PUT', path, answers())
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ status: 'confirmed', canEdit: false })
  })
})

describe('modifier', () => {
  it('se fait jusqu’à la clôture, avec la version du formulaire remplie (R9, R13)', async () => {
    const { path, period, registration, game } = await invitation()
    expect((await publicApi('PUT', path, answers())).status).toBe(200)

    // L'organisatrice retire ensuite le téléphone du formulaire : l'inscription garde sa version
    const standardFields = { lastName: { asked: true, required: true }, firstName: { asked: true, required: true }, facebookName: { asked: false, required: false }, phone: { asked: false, required: false }, emergencyContact: { asked: true, required: true }, dietary: { asked: true, required: false } }
    expect((await api(alice, 'PUT', `/api/games/${game.id}/registration-form`, { standardFields })).status).toBe(200)
    expect((await publicApi('PUT', path, answers({ phone: '' }))).status).toBe(400)

    const changed = await publicApi('PUT', path, answers({ phone: '0611111111', dietary: '', healthConsent: false }))
    expect(changed.status, JSON.stringify(changed.body)).toBe(200)
    expect(changed.body).toMatchObject({ status: 'confirmed', emailSent: null })
    const saved = await prisma.registration.findUniqueOrThrow({ where: { id: registration.id }, include: { formVersion: true } })
    expect(saved).toMatchObject({ phone: '0611111111', dietary: null, healthConsentAt: null })
    expect(saved.formVersion?.number).toBe(1)

    await prisma.registrationPeriod.update({ where: { id: period.id }, data: { state: 'closed' } })
    expect((await publicApi('GET', path)).body).toMatchObject({ status: 'confirmed', canEdit: false })
    expect((await publicApi('PUT', path, answers())).status).toBe(409)
  })
})

describe('décliner', () => {
  it('passe l’inscription à désistée, sans participation de session ; le lien ne permet plus rien', async () => {
    const { path, registration, session, participant, game } = await invitation()

    const response = await publicApi('POST', `${path}/decline`)

    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(response.body).toEqual({ status: 'withdrawn', game: { title: game.title }, withdrawalReason: 'declined' })
    const saved = await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })
    expect(saved.status).toBe('withdrawn')
    expect(saved.withdrawnAt).not.toBeNull()
    expect(await prisma.sessionParticipant.count({ where: { sessionId: session.id, participantId: participant.id } })).toBe(0)

    expect((await publicApi('GET', path)).body).toEqual({ status: 'withdrawn', game: { title: game.title }, withdrawalReason: 'declined' })
    expect((await publicApi('PUT', path, answers())).status).toBe(409)
    expect((await publicApi('POST', `${path}/decline`)).status).toBe(409)
  })

  it('n’est plus possible après avoir accepté (le désistement vient avec US-006)', async () => {
    const { path } = await invitation()
    await publicApi('PUT', path, answers())
    expect((await publicApi('POST', `${path}/decline`)).status).toBe(409)
  })
})

describe('se désister (US-006)', () => {
  const PHOTOS = join(process.cwd(), '.data', 'uploads', 'session-assignment-photos')

  it('libère la session et les personnages, efface la photo, régénère les trombinoscopes, garde le paiement visible et prévient les orgas', async () => {
    const { path, game, session, participant, registration } = await invitation()
    expect((await publicApi('PUT', path, answers())).status).toBe(200)

    // L'organisatrice a distribué un personnage avec une photo, un paiement est enregistré
    const character = await prisma.character.create({ data: { name: 'Roméo', slug: `romeo-${counter}`, gameId: game.id } })
    const filename = `photo-desistement-${counter}.png`
    const url = `/api/uploads/session-assignment-photos/${filename}`
    await mkdir(PHOTOS, { recursive: true })
    await writeFile(join(PHOTOS, filename), 'png')
    await prisma.uploadedFile.create({ data: { kind: 'session-assignment-photo', filename, url, gameId: game.id, sessionId: session.id } })
    const assignment = await prisma.sessionAssignment.create({ data: { sessionId: session.id, characterId: character.id, participantId: participant.id, photoUrl: url } })
    await prisma.sessionPayment.create({ data: { sessionId: session.id, participantId: participant.id, paidAt: new Date() } })
    await prisma.sessionTrombinoscope.create({ data: { sessionId: session.id, viewerCharacterId: character.id, participantId: participant.id, fileName: 't.pdf', contentHtml: url } })
    const sentBefore = smtp.received.length

    const response = await publicApi('POST', `${path}/withdraw`)

    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(response.body).toEqual({ status: 'withdrawn', game: { title: game.title }, withdrawalReason: 'withdrawn' })
    const saved = await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })
    expect(saved).toMatchObject({ status: 'withdrawn', withdrawnById: null })
    expect(saved.withdrawnAt).not.toBeNull()

    expect(await prisma.sessionParticipant.count({ where: { sessionId: session.id, participantId: participant.id } })).toBe(0)
    // Le personnage reste, sans joueur ni photo ; le fichier est effacé
    expect(await prisma.sessionAssignment.findUniqueOrThrow({ where: { id: assignment.id } })).toMatchObject({ participantId: null, photoUrl: null })
    expect(await prisma.uploadedFile.count({ where: { url } })).toBe(0)
    expect(existsSync(join(PHOTOS, filename))).toBe(false)
    // Le paiement reçu est gardé, à traiter à la main (R22), et reste visible dans le tableau des paiements
    expect(await prisma.sessionPayment.count({ where: { sessionId: session.id, participantId: participant.id } })).toBe(1)
    const payments = await api(alice, 'GET', `/api/sessions/${session.id}/payments`)
    expect((payments.body as any).unassignedPayments).toMatchObject([{ participant: { id: participant.id } }])
    expect((payments.body as any).rows).toEqual([])

    // Après la réponse : trombinoscopes régénérés sans elle, puis email aux organisateurs
    await expect.poll(() => smtp.received.slice(sentBefore).find((message) => message.to.includes('alice@example.test'))?.text, { timeout: 10_000 })
      .toContain(`${participant.name} s’est désisté·e de la session ${session.name}`)
    const notice = smtp.received.slice(sentBefore).find((message) => message.to.includes('alice@example.test'))!
    expect(notice.text).toContain('trombinoscopes de la session ont été régénérés')
    expect(await prisma.sessionTrombinoscope.count({ where: { sessionId: session.id, participantId: participant.id } })).toBe(0)

    // L'organisatrice voit le désistement dans la liste
    const list = await api(alice, 'GET', `/api/registration-periods/${saved.periodId}/registrations`)
    expect(list.body).toMatchObject([{ status: 'withdrawn', withdrawnBy: null }])

    // Le lien ne permet plus rien
    expect((await publicApi('POST', `${path}/withdraw`)).status).toBe(409)
    expect((await publicApi('PUT', path, answers())).status).toBe(409)
  })

  it('reste possible après la clôture (R13)', async () => {
    const { path, period } = await invitation()
    await publicApi('PUT', path, answers())
    await prisma.registrationPeriod.update({ where: { id: period.id }, data: { state: 'closed' } })

    expect((await publicApi('GET', path)).body).toMatchObject({ canEdit: false, canWithdraw: true })
    expect((await publicApi('POST', `${path}/withdraw`)).status).toBe(200)
  })

  it('n’est pas possible sur une invitation sans réponse : elle se décline', async () => {
    const { path, registration } = await invitation()
    expect((await publicApi('POST', `${path}/withdraw`)).status).toBe(409)
    expect((await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })).status).toBe('invited')
  })
})

describe('règles issues de la revue de code', () => {
  it('la date de consentement santé est celle du dernier enregistrement (R14)', async () => {
    const { path, registration } = await invitation()
    await publicApi('PUT', path, answers())
    const first = (await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })).healthConsentAt!
    await new Promise((resolve) => setTimeout(resolve, 20))

    await publicApi('PUT', path, answers({ dietary: 'Gluten' }))
    const second = (await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })).healthConsentAt!
    expect(second.getTime()).toBeGreaterThan(first.getTime())
  })

  it('une réponse invalide ne crée pas de version du formulaire', async () => {
    const { path, game } = await invitation()
    expect((await publicApi('PUT', path, answers({ phone: '' }))).status).toBe(400)
    expect(await prisma.registrationFormVersion.count({ where: { form: { gameId: game.id } } })).toBe(0)
  })

  it('deux premières réponses simultanées partagent la version 1', async () => {
    const first = await invitation()
    const period = await prisma.registrationPeriod.findUniqueOrThrow({ where: { id: first.period.id } })
    const other = await prisma.participant.create({ data: { name: 'Seconde Personne', slug: `seconde-personne-${counter}`, email: `seconde-${counter}@example.test`, gameLinks: { create: { gameId: first.game.id } } } })
    const token = randomBytes(32).toString('base64url')
    await prisma.registration.create({ data: { periodId: period.id, sessionId: first.session.id, participantId: other.id, status: 'invited', source: 'invitation', email: other.email!, tokenHash: sha256(token) } })

    const statuses = (await Promise.all([
      publicApi('PUT', first.path, answers()),
      publicApi('PUT', `/api/public/registrations/${token}`, answers({ email: `seconde-${counter}@example.test` }))
    ])).map((response) => response.status)
    expect(statuses).toEqual([200, 200])
    expect(await prisma.registrationFormVersion.count({ where: { form: { gameId: first.game.id } } })).toBe(1)
  })

  it('une place réattribuée faute de réponse le dit à la personne', async () => {
    const { path, registration } = await invitation()
    await prisma.registration.update({ where: { id: registration.id }, data: { status: 'withdrawn', withdrawnAt: new Date(), withdrawnById: alice.id } })
    expect((await publicApi('GET', path)).body).toMatchObject({ status: 'withdrawn', withdrawalReason: 'released' })
  })
})

describe('liens invalides (ADR-0018)', () => {
  it('jeton inconnu, invalidé, inscription supprimée ou lien expiré : même réponse', async () => {
    const replaced = await invitation()
    await prisma.registration.update({ where: { id: replaced.registration.id }, data: { tokenHash: sha256('autre') } })
    const deleted = await invitation()
    await prisma.registration.delete({ where: { id: deleted.registration.id } })
    const expired = await invitation({ sessionDate: new Date(Date.now() - 31 * 86_400_000) })

    const paths = [
      `/api/public/registrations/${randomBytes(32).toString('base64url')}`,
      '/api/public/registrations/pas-un-jeton',
      replaced.path,
      deleted.path,
      expired.path
    ]
    const responses = await Promise.all(paths.map((path) => publicApi('GET', path)))
    for (const response of responses) {
      expect(response.status).toBe(404)
      expect(response.body.message).toBe('Ce lien n’est pas valide.')
    }
    expect((await publicApi('PUT', replaced.path, answers())).status).toBe(404)
    expect((await publicApi('POST', `${deleted.path}/decline`)).status).toBe(404)
  })

  it('le débit est limité par IP', async () => {
    const { path } = await invitation()
    const ip = '10.9.9.9'
    const statuses = []
    for (let attempt = 0; attempt < 61; attempt++) {
      statuses.push((await publicApi('GET', path, undefined, ip)).status)
    }
    expect(statuses.slice(0, 60).every((status) => status === 200)).toBe(true)
    expect(statuses[60]).toBe(429)
    // Une autre IP n'est pas concernée
    expect((await publicApi('GET', path, undefined, '10.9.9.10')).status).toBe(200)
  })
})
