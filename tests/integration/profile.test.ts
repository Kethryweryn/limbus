// EPIC-016 : coordonnées tenues par la personne (US-074) et fiche verrouillée côté équipe (US-075)
import { createHash } from 'node:crypto'
import { afterAll, describe, expect, inject, it } from 'vitest'
import { api } from './api'
import { createTestPrisma } from './db'
import { withFicheValues } from '../fiche'

const prisma = createTestPrisma()
const { alice, bob } = inject('world').users
let counter = 0

afterAll(async () => {
  await prisma.$disconnect()
})

// Formulaire du jeu d'Alice : tout est demandé ; celui de Bob ne demande pas le téléphone. Contact d'urgence et
// allergies sont toujours demandés (US-181)
const FULL_FORM = { standardFields: { lastName: { asked: true, required: true }, firstName: { asked: true, required: true }, facebookName: { asked: false, required: false }, phone: { asked: true, required: true }, emergencyContact: { asked: true, required: true }, dietary: { asked: true, required: false } } }
const NO_PHONE_FORM = { standardFields: { ...FULL_FORM.standardFields, phone: { asked: false, required: false } } }

// Une personne avec un compte, inscrite et confirmée dans un jeu d'Alice et un jeu de Bob
async function personInTwoTeams() {
  const key = `profil-${++counter}`
  const user = await prisma.user.create({ data: { email: `${key}@example.test`, name: 'Camille Dupont', password: 'non-utilise' } })
  const teams = []
  // Une seule fiche par adresse (SPEC-022, US-240) : liée au jeu de chaque équipe
  const participant = await withFicheValues(prisma.participant.create({
    data: { slug: `fiche-${key}`, email: user.email, userId: user.id }
  }), { name: 'Nom saisi par l’équipe', phone: '0100000000' })
  for (const owner of [alice, bob]) {
    const k = `${key}-${owner.id}`.toLowerCase()
    const game = await prisma.game.create({ data: { title: `Jeu ${k}`, slug: `jeu-${k}`, description: '', ownerId: owner.id } })
    const session = await prisma.session.create({ data: { slug: `session-${k}`, gameId: game.id } })
    await prisma.participantGame.create({ data: { participantId: participant.id, gameId: game.id, name: 'Nom saisi par l’équipe', phone: '0100000000' } })
    const period = await prisma.registrationPeriod.create({ data: { gameId: game.id, publicId: `periode-${k}`, state: 'open' } })
    const definition = owner.id === alice.id ? FULL_FORM : NO_PHONE_FORM
    const form = await prisma.registrationForm.create({ data: { gameId: game.id, versions: { create: { number: 1, definition } } }, include: { versions: true } })
    await prisma.registration.create({
      data: {
        gameId: period.gameId, periodId: period.id,
        participantId: participant.id,
        status: 'received',
        sessionLines: { create: { sessionId: session.id, status: 'confirmed' } },
        source: 'invitation',
        email: user.email,
        formVersionId: form.versions[0]!.id,
        ...(owner.id === alice.id ? { dietary: 'Ancienne allergie', healthConsentAt: new Date() } : {})
      }
    })
    await prisma.sessionParticipant.create({ data: { sessionId: session.id, participantId: participant.id, role: 'participant' } })
    teams.push({ owner, game, session, participant })
  }
  return { user, teams }
}

const profile = { phone: '0612345678', emergencyContactName: 'Dominique', emergencyContactPhone: '0698765432', dietary: 'Sans gluten', healthConsent: true }

describe('mes coordonnées (US-074)', () => {
  it('se recopient sur les fiches et les inscriptions de chaque équipe, champs demandés seulement', async () => {
    const { user, teams } = await personInTwoTeams()
    expect((await api(user, 'PUT', '/api/account/profile', profile)).status).toBe(200)

    for (const { participant, game } of teams) {
      expect(await prisma.participantGame.findUniqueOrThrow({ where: { participantId_gameId: { participantId: participant.id, gameId: game.id } } })).toMatchObject({ name: 'Camille Dupont', phone: '0612345678' })
      expect(await prisma.registration.findFirstOrThrow({ where: { participantId: participant.id, gameId: game.id } })).toMatchObject({
        firstName: 'Camille', lastName: 'Dupont', emergencyContactName: 'Dominique', dietary: 'Sans gluten'
      })
    }
    // Téléphone : chez Alice, qui le demande ; jamais sur l'inscription chez Bob, dont le formulaire ne le demande pas
    const [aliceTeam, bobTeam] = teams
    expect((await prisma.registration.findFirstOrThrow({ where: { participantId: aliceTeam!.participant.id, gameId: aliceTeam!.game.id } })).phone).toBe('0612345678')
    expect((await prisma.registration.findFirstOrThrow({ where: { participantId: bobTeam!.participant.id, gameId: bobTeam!.game.id } })).phone).toBeNull()
    expect(JSON.stringify((await api(alice, 'GET', `/api/sessions/${aliceTeam!.session.id}/allergies`)).body)).toContain('Sans gluten')
    expect((await api(user, 'GET', '/api/account')).body).toMatchObject({ profile: { phone: '0612345678', dietary: 'Sans gluten', healthConsent: true } })
  })

  it('exige le consentement pour des allergies', async () => {
    const { user } = await personInTwoTeams()
    expect((await api(user, 'PUT', '/api/account/profile', { ...profile, healthConsent: false })).status).toBe(400)
  })

  it('rien n’est recopié tant que la personne n’a pas enregistré ses coordonnées', async () => {
    const { user, teams } = await personInTwoTeams()
    expect((await api(user, 'PUT', '/api/account', { name: 'Autre Nom' })).status).toBe(200)
    expect((await prisma.participantGame.findMany({ where: { participantId: teams[0]!.participant.id }, select: { name: true } })).map((link) => link.name))
      .toEqual(['Nom saisi par l’équipe', 'Nom saisi par l’équipe'])
  })

  it('une fiche rattachée après coup prend les coordonnées du compte', async () => {
    const { user } = await personInTwoTeams()
    await api(user, 'PUT', '/api/account/profile', profile)
    // Une autre équipe, qui n'a pas encore de fiche pour cette adresse (une seule fiche par adresse, US-185)
    const { carol } = inject('world').users
    const game = await prisma.game.create({ data: { title: `Jeu de Carol ${++counter}`, slug: `jeu-carol-${counter}`, description: '', ownerId: carol.id } })
    const created = await api(carol, 'POST', '/api/participants', { name: 'Saisie', email: user.email, phone: '0000', gameIds: [game.id] })
    expect(created.status).toBe(200)
    expect(created.body).toMatchObject({ name: 'Camille Dupont', phone: '0612345678' })
  })
})

describe('inscriptions et coordonnées (US-074)', () => {
  it('une invitation est préremplie avec les coordonnées, et la réponse les met à jour partout', async () => {
    const { user, teams } = await personInTwoTeams()
    await api(user, 'PUT', '/api/account/profile', profile)
    const { game, participant } = teams[0]!
    // Le vivier du jeu, où cette personne n'a pas encore répondu
    const period = await prisma.registrationPeriod.findUniqueOrThrow({ where: { gameId: game.id } })
    await prisma.registration.deleteMany({ where: { periodId: period.id, participantId: participant.id } })
    const invited = await prisma.registration.create({
      data: { gameId: period.gameId, periodId: period.id, participantId: participant.id, status: 'invited', source: 'invitation', email: user.email, responseDueAt: new Date(Date.now() + 86_400_000) }
    })
    expect((await api(user, 'GET', `/api/me/registrations/${invited.id}`)).body).toMatchObject({ answers: { phone: '0612345678', emergencyContactName: 'Dominique', dietary: 'Sans gluten', healthConsent: true } })

    const answers = { email: user.email, firstName: 'Camille', lastName: 'Martin', phone: '0611111111', emergencyContactName: 'Dominique', emergencyContactPhone: '0698765432', dietary: '', charterAccepted: true }
    expect((await api(user, 'PUT', `/api/me/registrations/${invited.id}`, answers)).status).toBe(200)
    expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({ name: 'Camille Martin', phone: '0611111111', dietary: null })
    // Recopié aussi dans l'autre équipe, qui ne demande pas le téléphone
    expect(await prisma.registration.findFirstOrThrow({ where: { participantId: teams[1]!.participant.id, gameId: teams[1]!.game.id } })).toMatchObject({ lastName: 'Martin', phone: null, dietary: null })
  })
})

describe('allergies du cast (US-074)', () => {
  it('une personne du cast sans inscription figure avec les allergies de son compte', async () => {
    const { user, teams } = await personInTwoTeams()
    await api(user, 'PUT', '/api/account/profile', profile)
    const { game } = teams[0]!
    const npc = teams[0]!.participant
    const other = await prisma.session.create({ data: { slug: `autre-session-${++counter}`, gameId: game.id } })
    await prisma.sessionParticipant.create({ data: { sessionId: other.id, participantId: npc.id, role: 'npc' } })
    expect(JSON.stringify((await api(alice, 'GET', `/api/sessions/${other.id}/allergies`)).body)).toContain('Sans gluten')
  })
})

describe('lien personnel (US-074)', () => {
  it('une réponse par le lien personnel ne modifie pas le compte', async () => {
    const { user, teams } = await personInTwoTeams()
    await api(user, 'PUT', '/api/account/profile', profile)
    const { game, participant } = teams[0]!
    const token = `${'x'.repeat(30)}${String(++counter).padStart(13, '0')}`
    const period = await prisma.registrationPeriod.findUniqueOrThrow({ where: { gameId: game.id } })
    await prisma.registration.deleteMany({ where: { periodId: period.id, participantId: participant.id } })
    await prisma.registration.create({
      data: { gameId: period.gameId, periodId: period.id, participantId: participant.id, status: 'invited', source: 'invitation', email: user.email, links: { create: { tokenHash: createHash('sha256').update(token).digest('hex') } }, responseDueAt: new Date(Date.now() + 86_400_000) }
    })
    const answers = { email: user.email, firstName: 'Quelqu’un', lastName: 'D’autre', phone: '0799999999', emergencyContactName: 'X', emergencyContactPhone: '0700000000', charterAccepted: true }
    const response = await api(null, 'PUT', `/api/public/registrations/${token}`, answers)
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({ name: 'Camille Dupont', phone: '0612345678' })
  })
})

describe('fiche tenue par la personne (US-075)', () => {
  it('l’équipe ne change ni le nom ni le téléphone ; corriger l’email emmène ses jeux sur une autre fiche, sans le compte', async () => {
    const { user, teams } = await personInTwoTeams()
    await api(user, 'PUT', '/api/account/profile', profile)
    const { participant, game } = teams[0]!
    const body = { name: 'Renommée par l’équipe', email: user.email, phone: '0700000000', gameIds: [game.id] }
    expect((await api(alice, 'PUT', `/api/participants/${participant.id}`, body)).status).toBe(200)
    expect(await prisma.participant.findUniqueOrThrow({ where: { id: participant.id }, select: { userId: true } })).toEqual({ userId: user.id })
    expect(await prisma.participantGame.findUniqueOrThrow({ where: { participantId_gameId: { participantId: participant.id, gameId: game.id } } })).toMatchObject({ name: 'Camille Dupont', phone: '0612345678' })

    // La fiche est aussi suivie par Bob : la correction d'Alice ne vaut que pour son jeu (SPEC-022 R7)
    const corrected = await api(alice, 'PUT', `/api/participants/${participant.id}`, { ...body, email: `erreur-${user.id}@example.test` })
    expect(corrected.status).toBe(200)
    const moved = corrected.body as { id: string, name: string, phone: string | null }
    expect(moved.id).not.toBe(participant.id)
    expect(moved).toMatchObject({ name: 'Renommée par l’équipe', phone: '0700000000' })
    expect(await prisma.participant.findUniqueOrThrow({ where: { id: moved.id } })).toMatchObject({ userId: null })
    expect(await prisma.participant.findUniqueOrThrow({ where: { id: participant.id }, select: { userId: true, gameLinks: { select: { gameId: true } } } }))
      .toEqual({ userId: user.id, gameLinks: [{ gameId: teams[1]!.game.id }] })
  })

  it('tenue par la personne, la fiche garde dans chaque jeu ses valeurs, jamais celles d’une autre équipe (revue de la PR #237)', async () => {
    const { user, teams } = await personInTwoTeams()
    const [mine, bobs] = teams
    // Bob modifie son jeu en dernier ; la personne n'a pas encore enregistré ses coordonnées
    await prisma.participantGame.update({ where: { participantId_gameId: { participantId: bobs!.participant.id, gameId: bobs!.game.id } }, data: { name: 'Nom chez Bob', phone: '0699999999' } })
    const body = { name: 'Renommée par l’équipe', email: user.email, phone: '0700000000', gameIds: [mine!.game.id] }
    expect((await api(alice, 'PUT', `/api/participants/${mine!.participant.id}`, body)).status).toBe(200)
    expect(await prisma.participantGame.findUniqueOrThrow({ where: { participantId_gameId: { participantId: mine!.participant.id, gameId: mine!.game.id } }, select: { name: true, phone: true } }))
      .toEqual({ name: 'Nom saisi par l’équipe', phone: '0100000000' })

    // Export de l'équipe : le nom et le téléphone de son jeu, rien de ceux de Bob
    const exported = await api(alice, 'GET', `/api/participants/${mine!.participant.id}/export`)
    expect(exported.body).toMatchObject({ games: [{ name: 'Nom saisi par l’équipe', phone: '0100000000' }] })
    expect(JSON.stringify(exported.body)).not.toMatch(/Nom chez Bob|0699999999/)
  })
})
