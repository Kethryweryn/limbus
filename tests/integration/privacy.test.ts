// Révocation des sessions et droits RGPD des participants (effacement, accès)
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterAll, describe, expect, inject, it } from 'vitest'
import { api, DENIED } from './api'
import { createTestPrisma } from './db'

const world = inject('world')
const { alice, admin } = world.users
const { a, b } = world
const prisma = createTestPrisma()

afterAll(async () => {
  await prisma.$disconnect()
})

// Utilisateur jetable : révoquer ses sessions ne doit pas gêner les autres tests
function createUser(key: string) {
  return prisma.user.create({ data: { email: `${key}@example.test`, name: key, password: 'non-utilise' } })
}

describe('révocation des sessions', () => {
  it('« déconnecter tous mes appareils » invalide les jetons déjà émis', async () => {
    const dave = await createUser('dave')
    expect((await api(dave, 'GET', '/api/games')).status).toBe(200)

    expect((await api(dave, 'POST', '/api/auth/logout-all')).status).toBe(200)

    expect((await api(dave, 'GET', '/api/games')).status).toBe(401)
    expect((await api(dave, 'GET', '/api/auth/me')).body).toEqual({ authenticated: false })
  })

  it('un changement de mot de passe par un admin déconnecte le compte', async () => {
    const erin = await createUser('erin')
    expect((await api(erin, 'GET', '/api/games')).status).toBe(200)

    expect((await api(admin, 'PUT', `/api/admin/users/${erin.id}`, { password: 'nouveau-mot-de-passe' })).status).toBe(200)

    expect((await api(erin, 'GET', '/api/games')).status).toBe(401)
  })

  it('un changement de nom seul ne déconnecte pas', async () => {
    const fred = await createUser('fred')
    expect((await api(admin, 'PUT', `/api/admin/users/${fred.id}`, { name: 'Fred' })).status).toBe(200)
    expect((await api(fred, 'GET', '/api/games')).status).toBe(200)
  })
})

describe('export des données d’un participant', () => {
  it('refusé pour un participant de Bob, autorisé chez soi', async () => {
    expect(DENIED).toContain((await api(alice, 'GET', `/api/participants/${b.participant.id}/export`)).status)

    // Valeurs relues en base : les tests d'isolation renomment les données d'Alice
    const participant = await prisma.participant.findUniqueOrThrow({ where: { id: a.participant.id } })
    const game = await prisma.game.findUniqueOrThrow({ where: { id: a.game.id } })
    const response = await api(alice, 'GET', `/api/participants/${a.participant.id}/export`)
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ name: participant.name, email: participant.email, games: [{ title: game.title }] })
  })

  it('un participant inscrit chez Alice et chez Bob n’expose que le jeu d’Alice', async () => {
    const shared = await prisma.participant.create({
      data: {
        name: 'Partagé',
        slug: 'participant-partage-export',
        gameLinks: { create: [{ gameId: a.game.id }, { gameId: b.game.id }] },
        sessionRoles: { create: [{ sessionId: a.session.id, role: 'participant' }, { sessionId: b.session.id, role: 'participant' }] }
      }
    })

    const response = await api(alice, 'GET', `/api/participants/${shared.id}/export`)
    expect(response.status).toBe(200)
    const body = response.body as { games: unknown[], sessionRoles: unknown[] }
    expect(body.games).toHaveLength(1)
    expect(body.sessionRoles).toHaveLength(1)
    expect(JSON.stringify(body)).not.toContain(b.game.title)
    expect(JSON.stringify(body)).not.toContain(b.session.name)
  })
})

describe('inscriptions d’un participant (US-003)', () => {
  it('l’export contient ses inscriptions, limitées aux jeux de l’organisatrice', async () => {
    const shared = await prisma.participant.create({
      data: { name: 'Inscrit partout', slug: 'participant-inscrit-partout', email: 'partout@example.test', gameLinks: { create: [{ gameId: a.game.id }, { gameId: b.game.id }] } }
    })
    for (const w of [a, b]) {
      await prisma.registration.create({
        data: { periodId: w.registrationPeriod.id, sessionId: w.session.id, participantId: shared.id, status: 'confirmed', source: 'invitation', email: 'partout@example.test', dietary: `Allergie ${w.game.id}` }
      })
    }

    const response = await api(alice, 'GET', `/api/participants/${shared.id}/export`)
    expect(response.status).toBe(200)
    const body = response.body as { registrations: Array<{ dietary: string }> }
    expect(body.registrations).toHaveLength(1)
    expect(body.registrations[0]!.dietary).toBe(`Allergie ${a.game.id}`)
    expect(JSON.stringify(body)).not.toContain(b.game.id)
  })

  it('l’export d’une inscription contient sa dernière relance, et qui a invité ou retiré la personne (US-037)', async () => {
    const person = await prisma.participant.create({
      data: { name: 'Relancée', slug: 'participant-relancee', email: 'relancee@example.test', gameLinks: { create: [{ gameId: a.game.id }] } }
    })
    const remindedAt = new Date('2026-10-20T10:00:00.000Z')
    await prisma.registration.create({
      data: {
        periodId: a.registrationPeriod.id, participantId: person.id, status: 'withdrawn', source: 'invitation', email: 'relancee@example.test',
        lastRemindedAt: remindedAt, invitedById: alice.id, withdrawnById: alice.id, withdrawnAt: new Date()
      }
    })

    const body = (await api(alice, 'GET', `/api/participants/${person.id}/export`)).body as {
      registrations: Array<{ lastRemindedAt: string, invitedBy: { name: string }, withdrawnBy: { name: string } }>
    }
    expect(body.registrations[0]).toMatchObject({
      lastRemindedAt: remindedAt.toISOString(),
      invitedBy: { name: alice.name },
      withdrawnBy: { name: alice.name }
    })
  })

  it('la suppression du participant efface ses inscriptions', async () => {
    const participant = await prisma.participant.create({
      data: { name: 'Inscrit effacé', slug: 'participant-inscrit-efface', email: 'inscrit-efface@example.test', gameLinks: { create: { gameId: a.game.id } } }
    })
    await prisma.registration.create({
      data: { periodId: a.registrationPeriod.id, sessionId: a.session.id, participantId: participant.id, status: 'invited', source: 'invitation', email: 'inscrit-efface@example.test', phone: '0600000000' }
    })

    expect((await api(alice, 'DELETE', `/api/participants/${participant.id}`)).status).toBe(200)
    expect(await prisma.registration.count({ where: { participantId: participant.id } })).toBe(0)
  })
})

describe('suppression d’un participant', () => {
  it('efface ses photos (fichier compris) et les trombinoscopes qui les contiennent', async () => {
    const participant = await prisma.participant.create({
      data: { name: 'À effacer', slug: 'participant-a-effacer', email: 'efface@example.test', gameLinks: { create: { gameId: a.game.id } } }
    })
    const character = await prisma.character.create({
      data: { name: 'Rôle à effacer', slug: 'role-a-effacer', gameId: a.game.id }
    })
    const filename = 'photo-a-effacer.png'
    const url = `/api/uploads/session-assignment-photos/${filename}`
    const dir = join(process.cwd(), '.data', 'uploads', 'session-assignment-photos')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, filename), 'png')
    await prisma.uploadedFile.create({ data: { kind: 'session-assignment-photo', filename, url, gameId: a.game.id, sessionId: a.session.id } })
    const assignment = await prisma.sessionAssignment.create({
      data: { sessionId: a.session.id, characterId: character.id, participantId: participant.id, photoUrl: url }
    })
    await prisma.sessionPayment.create({ data: { sessionId: a.session.id, participantId: participant.id } })
    // Trombinoscope d'un autre participant de la session, qui contient cette photo
    await prisma.sessionTrombinoscope.create({
      data: { sessionId: a.session.id, viewerCharacterId: a.character.id, participantId: a.participant.id, fileName: 't.pdf', contentHtml: url }
    })

    const response = await api(alice, 'DELETE', `/api/participants/${participant.id}`)
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ deletedPhotos: 1 })

    expect(await prisma.participant.findUnique({ where: { id: participant.id } })).toBeNull()
    expect(await prisma.sessionPayment.count({ where: { participantId: participant.id } })).toBe(0)
    expect(await prisma.uploadedFile.findUnique({ where: { filename } })).toBeNull()
    expect(existsSync(join(dir, filename))).toBe(false)
    expect(await prisma.sessionTrombinoscope.count({ where: { sessionId: a.session.id } })).toBe(0)
    // Le rôle reste distribuable : l'assignation est gardée, vidée
    expect(await prisma.sessionAssignment.findUnique({ where: { id: assignment.id } })).toMatchObject({ participantId: null, photoUrl: null })
  })

  it('garde une photo encore utilisée comme photo de personnage', async () => {
    const participant = await prisma.participant.create({
      data: { name: 'Photo partagée', slug: 'participant-photo-partagee', gameLinks: { create: { gameId: a.game.id } } }
    })
    const url = '/api/uploads/session-assignment-photos/photo-partagee.png'
    const character = await prisma.character.create({
      data: { name: 'Rôle photo partagée', slug: 'role-photo-partagee', gameId: a.game.id, trombinoscopePhotoUrl: url }
    })
    await prisma.uploadedFile.create({ data: { kind: 'session-assignment-photo', filename: 'photo-partagee.png', url, gameId: a.game.id } })
    await prisma.sessionAssignment.create({
      data: { sessionId: a.session.id, characterId: character.id, participantId: participant.id, photoUrl: url }
    })

    const response = await api(alice, 'DELETE', `/api/participants/${participant.id}`)
    expect(response.body).toMatchObject({ deletedPhotos: 0 })
    expect(await prisma.uploadedFile.findUnique({ where: { url } })).not.toBeNull()
  })
})
