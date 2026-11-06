// EPIC-017 : télécharger ses données (US-076) et effacer son compte, équipes prévenues (US-077)
import bcrypt from 'bcrypt'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { api } from './api'
import { createTestPrisma } from './db'
import { startTestSmtp } from './smtp'

const prisma = createTestPrisma()
const { alice, bob } = inject('world').users
let smtp: Awaited<ReturnType<typeof startTestSmtp>>
let counter = 0
const PASSWORD = 'mot-de-passe-actuel'

beforeAll(async () => {
  smtp = await startTestSmtp(prisma)
})

afterAll(async () => {
  await smtp.stop()
  await prisma.$disconnect()
})

// Une joueuse avec un compte, une fiche dans un jeu d'Alice (place et paiement) et une dans un jeu de Bob
async function player() {
  const key = `efface-${++counter}`
  const user = await prisma.user.create({
    data: { email: `${key}@example.test`, name: 'Joueuse Effacée', password: await bcrypt.hash(PASSWORD, 4), phone: '0612345678', dietary: 'Arachides', healthConsentAt: new Date(), profileUpdatedAt: new Date() }
  })
  const teams = []
  for (const owner of [alice, bob]) {
    const k = `${key}-${owner.id}`.toLowerCase()
    const game = await prisma.game.create({ data: { title: `Jeu ${k}`, slug: `jeu-${k}`, description: '', ownerId: owner.id } })
    const session = await prisma.session.create({ data: { name: `Session ${k}`, slug: `session-${k}`, gameId: game.id } })
    const participant = await prisma.participant.create({
      data: { name: 'Joueuse Effacée', slug: `fiche-${k}`, email: user.email, userId: user.id, gameLinks: { create: { gameId: game.id, notes: `Note de ${owner.id}` } } }
    })
    await prisma.sessionParticipant.create({ data: { sessionId: session.id, participantId: participant.id, role: 'participant' } })
    teams.push({ owner, game, session, participant })
  }
  const payment = await prisma.sessionPayment.create({ data: { sessionId: teams[0]!.session.id, participantId: teams[0]!.participant.id } })
  await prisma.sessionPaymentInstalment.create({ data: { paymentId: payment.id, amountCents: 4500, receivedAt: new Date() } })
  return { user, teams }
}

describe('télécharger ses données (US-076)', () => {
  it('contient le compte, les coordonnées et les fiches de toutes les équipes, sans secret', async () => {
    const { user, teams } = await player()
    const response = await api(user, 'GET', '/api/account/export')
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ account: { email: user.email, phone: '0612345678', dietary: 'Arachides' } })
    const text = JSON.stringify(response.body)
    for (const { owner, game } of teams) {
      expect(text).toContain(game.title)
      expect(text).toContain(`Note de ${owner.id}`)
    }
    expect(text).not.toContain(user.password)
    expect(text).not.toContain('sessionVersion')
  })

  it('dit pour chaque session ce que montre sa page : pas de décision non annoncée (R28), l’équipe garde tout', async () => {
    const { user, teams } = await player()
    const { game, participant, owner, session } = teams[0]!
    const announced = await prisma.session.create({ data: { name: `Annoncée ${++counter}`, slug: `annoncee-${counter}`, gameId: game.id } })
    const period = await prisma.registrationPeriod.create({ data: { gameId: game.id, publicId: `export-lignes-${counter}` } })
    const remindedAt = new Date('2026-10-20T10:00:00.000Z')
    await prisma.registration.create({
      data: {
        periodId: period.id, participantId: participant.id, status: 'received', source: 'form', email: user.email,
        sessionLines: { create: [
          // Mise en attente sans annonce : elle se voit encore pré-inscrite
          { sessionId: session.id, status: 'waitlisted', waitlistPosition: 2, answer: 'available', retainedById: owner.id },
          { sessionId: announced.id, status: 'waitlisted', waitlistPosition: 3, answer: 'available', announcedStatus: 'waitlisted', lastRemindedAt: remindedAt }
        ] }
      }
    })
    type Line = { status: string, waitlistPosition: number | null, lastRemindedAt: string | null, retainedBy?: { name: string } | null, session: { name: string } }
    type Export = { registrations: Array<{ sessionLines: Line[] }> }
    const linesOf = (exported: Export | undefined) => exported!.registrations.flatMap((registration) => registration.sessionLines)
    const byPerson = (await api(user, 'GET', '/api/account/export')).body as { participantRecords: Export[] }
    const mine = byPerson.participantRecords.flatMap(linesOf)
    expect(mine.find((line) => line.session.name === session.name)).toMatchObject({ status: 'preregistered', waitlistPosition: null })
    expect(mine.find((line) => line.session.name === session.name)).not.toHaveProperty('retainedBy')
    expect(mine.find((line) => line.session.name === announced.name)).toMatchObject({ status: 'waitlisted', waitlistPosition: 3, lastRemindedAt: remindedAt.toISOString() })

    const byTeam = linesOf((await api(owner, 'GET', `/api/participants/${participant.id}/export`)).body as Export)
    expect(byTeam.find((line) => line.session.name === session.name)).toMatchObject({ status: 'waitlisted', waitlistPosition: 2, retainedBy: { name: owner.name } })
  })

  it('contient ses affinités, sans la personne que l’équipe y a rattachée (R24, US-095)', async () => {
    const { user, teams } = await player()
    const { game, participant } = teams[0]!
    const target = await prisma.participant.create({ data: { name: 'Cible Rattachée', slug: `cible-${++counter}`, gameLinks: { create: { gameId: game.id } } } })
    const period = await prisma.registrationPeriod.create({ data: { gameId: game.id, publicId: `efface-periode-${counter}` } })
    await prisma.registration.create({
      data: {
        periodId: period.id, participantId: participant.id, status: 'received', source: 'form', email: user.email,
        affinities: { create: { kind: 'avoid', text: 'La cible', position: 0, targetParticipantId: target.id } }
      }
    })
    const text = JSON.stringify((await api(user, 'GET', '/api/account/export')).body)
    expect(text).toContain('La cible')
    expect(text).not.toContain('Cible Rattachée')
    expect(text).not.toContain('targetUnknown')
  })
})

describe('effacer son compte (US-077)', () => {
  it('refusé sans le bon mot de passe, ou tant qu’elle possède un jeu', async () => {
    const { user } = await player()
    expect((await api(user, 'POST', '/api/account/delete', { password: 'faux' })).status).toBe(400)
    const owned = await prisma.game.create({ data: { title: 'Son jeu', slug: `son-jeu-${++counter}`, description: '', ownerId: user.id } })
    expect((await api(user, 'POST', '/api/account/delete', { password: PASSWORD })).status).toBe(409)
    await prisma.game.delete({ where: { id: owned.id } })
    expect((await api(user, 'POST', '/api/account/delete', { password: PASSWORD })).status).toBe(200)
  })

  it('efface le compte et ses fiches, et prévient chaque équipe avec ses places et paiements', async () => {
    const { user, teams } = await player()
    const sent = smtp.received.length
    const response = await api(user, 'POST', '/api/account/delete', { password: PASSWORD })
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    expect(response.body).toMatchObject({ erasedParticipants: 2, teams: 2, teamsNotified: 2 })

    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull()
    expect(await prisma.participant.count({ where: { id: { in: teams.map((team) => team.participant.id) } } })).toBe(0)
    expect((await api(user, 'GET', '/api/auth/me')).body).toEqual({ authenticated: false })

    const messages = smtp.received.slice(sent)
    const [aliceTeam, bobTeam] = teams
    const toAlice = messages.find((message) => message.to.includes('alice@example.test'))!
    expect(toAlice.text).toContain(aliceTeam!.session.name)
    expect(toAlice.text).toMatch(/45,00/)
    const toBob = messages.find((message) => message.to.includes('bob@example.test'))!
    expect(toBob.text).toContain(bobTeam!.session.name)
    expect(toBob.text).not.toContain(aliceTeam!.session.name)
  })
})
