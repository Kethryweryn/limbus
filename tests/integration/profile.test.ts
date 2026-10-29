// EPIC-016 : coordonnées tenues par la personne (US-074) et fiche verrouillée côté équipe (US-075)
import { afterAll, describe, expect, inject, it } from 'vitest'
import { api } from './api'
import { createTestPrisma } from './db'

const prisma = createTestPrisma()
const { alice, bob } = inject('world').users
let counter = 0

afterAll(async () => {
  await prisma.$disconnect()
})

// Une personne avec un compte, inscrite et confirmée dans un jeu d'Alice et un jeu de Bob
async function personInTwoTeams() {
  const key = `profil-${++counter}`
  const user = await prisma.user.create({ data: { email: `${key}@example.test`, name: 'Camille Dupont', password: 'non-utilise' } })
  const teams = []
  for (const owner of [alice, bob]) {
    const k = `${key}-${owner.id}`.toLowerCase()
    const game = await prisma.game.create({ data: { title: `Jeu ${k}`, slug: `jeu-${k}`, description: '', ownerId: owner.id } })
    const session = await prisma.session.create({ data: { name: `Session ${k}`, slug: `session-${k}`, gameId: game.id } })
    const participant = await prisma.participant.create({
      data: { name: 'Nom saisi par l’équipe', slug: `fiche-${k}`, email: user.email, phone: '0100000000', userId: user.id, gameLinks: { create: { gameId: game.id } } }
    })
    const period = await prisma.registrationPeriod.create({ data: { gameId: game.id, name: `Période ${k}`, publicId: `periode-${k}`, state: 'open' } })
    await prisma.registration.create({
      data: { periodId: period.id, sessionId: session.id, participantId: participant.id, status: 'confirmed', source: 'invitation', email: user.email, dietary: 'Ancienne allergie', healthConsentAt: new Date() }
    })
    await prisma.sessionParticipant.create({ data: { sessionId: session.id, participantId: participant.id, role: 'participant' } })
    teams.push({ owner, game, session, participant })
  }
  return { user, teams }
}

const profile = { phone: '0612345678', emergencyContactName: 'Dominique', emergencyContactPhone: '0698765432', dietary: 'Sans gluten', healthConsent: true }

describe('mes coordonnées (US-074)', () => {
  it('se recopient sur les fiches, les inscriptions et la fiche allergies de chaque équipe', async () => {
    const { user, teams } = await personInTwoTeams()
    expect((await api(user, 'PUT', '/api/account/profile', profile)).status).toBe(200)

    for (const { owner, session, participant } of teams) {
      expect(await prisma.participant.findUniqueOrThrow({ where: { id: participant.id } })).toMatchObject({ name: 'Camille Dupont', phone: '0612345678' })
      expect(await prisma.registration.findFirstOrThrow({ where: { participantId: participant.id } })).toMatchObject({
        firstName: 'Camille', lastName: 'Dupont', phone: '0612345678', emergencyContactName: 'Dominique', dietary: 'Sans gluten'
      })
      const sheet = await api(owner, 'GET', `/api/sessions/${session.id}/allergies`)
      expect(JSON.stringify(sheet.body)).toContain('Sans gluten')
    }
    expect((await api(user, 'GET', '/api/account')).body).toMatchObject({ profile: { phone: '0612345678', dietary: 'Sans gluten', healthConsent: true } })
  })

  it('exige le consentement pour des allergies', async () => {
    const { user } = await personInTwoTeams()
    expect((await api(user, 'PUT', '/api/account/profile', { ...profile, healthConsent: false })).status).toBe(400)
  })

  it('rien n’est recopié tant que la personne n’a pas enregistré ses coordonnées', async () => {
    const { user, teams } = await personInTwoTeams()
    expect((await api(user, 'PUT', '/api/account', { name: 'Autre Nom' })).status).toBe(200)
    expect((await prisma.participant.findUniqueOrThrow({ where: { id: teams[0]!.participant.id } })).name).toBe('Nom saisi par l’équipe')
  })

  it('une fiche rattachée après coup prend les coordonnées du compte', async () => {
    const { user, teams } = await personInTwoTeams()
    await api(user, 'PUT', '/api/account/profile', profile)
    const created = await api(alice, 'POST', '/api/participants', { name: 'Saisie', email: user.email, phone: '0000', gameIds: [teams[0]!.game.id] })
    expect(created.status).toBe(200)
    expect(created.body).toMatchObject({ name: 'Camille Dupont', phone: '0612345678' })
  })
})

describe('inscriptions et coordonnées (US-074)', () => {
  it('une invitation est préremplie avec les coordonnées, et la réponse les met à jour partout', async () => {
    const { user, teams } = await personInTwoTeams()
    await api(user, 'PUT', '/api/account/profile', profile)
    const { game, participant } = teams[0]!
    const period = await prisma.registrationPeriod.create({ data: { gameId: game.id, name: `Invitation ${++counter}`, publicId: `invitation-profil-${counter}`, state: 'open' } })
    const invited = await prisma.registration.create({
      data: { periodId: period.id, participantId: participant.id, status: 'invited', source: 'invitation', email: user.email, responseDueAt: new Date(Date.now() + 86_400_000) }
    })
    expect((await api(user, 'GET', `/api/me/registrations/${invited.id}`)).body).toMatchObject({ answers: { phone: '0612345678', emergencyContactName: 'Dominique', dietary: 'Sans gluten', healthConsent: true } })

    const answers = { email: user.email, firstName: 'Camille', lastName: 'Martin', phone: '0611111111', emergencyContactName: 'Dominique', emergencyContactPhone: '0698765432', dietary: '', charterAccepted: true }
    expect((await api(user, 'PUT', `/api/me/registrations/${invited.id}`, answers)).status).toBe(200)
    expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({ name: 'Camille Martin', phone: '0611111111', dietary: null })
    // Recopié aussi dans l'autre équipe
    expect(await prisma.registration.findFirstOrThrow({ where: { participantId: teams[1]!.participant.id } })).toMatchObject({ lastName: 'Martin', phone: '0611111111', dietary: null })
  })
})

describe('fiche tenue par la personne (US-075)', () => {
  it('l’équipe ne change ni le nom ni le téléphone ; changer l’email détache la fiche', async () => {
    const { user, teams } = await personInTwoTeams()
    await api(user, 'PUT', '/api/account/profile', profile)
    const { participant, game } = teams[0]!
    const body = { name: 'Renommée par l’équipe', email: user.email, phone: '0700000000', gameIds: [game.id] }
    expect((await api(alice, 'PUT', `/api/participants/${participant.id}`, body)).status).toBe(200)
    expect(await prisma.participant.findUniqueOrThrow({ where: { id: participant.id } })).toMatchObject({ name: 'Camille Dupont', phone: '0612345678', userId: user.id })

    expect((await api(alice, 'PUT', `/api/participants/${participant.id}`, { ...body, email: 'erreur@example.test' })).status).toBe(200)
    expect(await prisma.participant.findUniqueOrThrow({ where: { id: participant.id } })).toMatchObject({ name: 'Renommée par l’équipe', phone: '0700000000', userId: null })
  })
})
