import type { PrismaClient } from '~/generated/prisma/client'

export type GameWorld = Awaited<ReturnType<typeof createGameWorld>>
export type World = Awaited<ReturnType<typeof createWorld>>

// Un jeu complet appartenant à `ownerId`, avec une entité de chaque type reliée entre elles
async function createGameWorld(prisma: PrismaClient, key: string, ownerId: string) {
  const game = await prisma.game.create({
    data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: '', ownerId }
  })
  const gameId = game.id
  const faction = await prisma.faction.create({ data: { name: `Faction ${key}`, slug: `faction-${key}`, gameId } })
  const character = await prisma.character.create({
    data: { name: `Perso ${key}`, slug: `perso-${key}`, gameId, factions: { connect: { id: faction.id } } }
  })
  const intrigue = await prisma.intrigue.create({ data: { name: `Intrigue ${key}`, slug: `intrigue-${key}`, gameId } })
  const item = await prisma.item.create({ data: { name: `Objet ${key}`, slug: `objet-${key}`, gameId } })
  const location = await prisma.location.create({ data: { name: `Lieu ${key}`, slug: `lieu-${key}`, gameId } })
  const document = await prisma.document.create({
    data: { title: `Document ${key}`, slug: `document-${key}`, content: 'Contenu', gameId }
  })
  const timelineEvent = await prisma.timelineEvent.create({
    data: { name: `Événement ${key}`, slug: `evenement-${key}`, day: 1, time: '10:00', gameId }
  })
  const participant = await prisma.participant.create({
    data: {
      name: `Joueur ${key}`,
      slug: `joueur-${key}`,
      email: `joueur-${key}@example.test`,
      gameLinks: { create: { gameId } }
    }
  })
  const session = await prisma.session.create({
    data: {
      name: `Session ${key}`,
      slug: `session-${key}`,
      gameId,
      locationId: location.id,
      participants: { create: { participantId: participant.id, role: 'participant' } },
      assignments: { create: { characterId: character.id, participantId: participant.id } }
    }
  })
  const photo = await prisma.uploadedFile.create({
    data: {
      kind: 'session-assignment-photo',
      filename: `photo-${key}.png`,
      url: `/api/uploads/session-assignment-photos/photo-${key}.png`,
      gameId,
      sessionId: session.id
    }
  })
  const rib = await prisma.uploadedFile.create({
    data: {
      kind: 'session-payment-rib',
      filename: `rib-${key}.pdf`,
      url: `/api/uploads/session-payment-ribs/rib-${key}.pdf`,
      gameId,
      sessionId: session.id
    }
  })
  const registrationPeriod = await prisma.registrationPeriod.create({
    data: {
      name: `Inscriptions ${key}`,
      gameId,
      publicId: `periode-${key}`,
      sessions: { create: { sessionId: session.id, seats: 10 } }
    }
  })
  const invitation = await prisma.gameInvitation.create({
    data: { gameId, email: `invite-${key}@example.test`, token: `token-${key}`, invitedById: ownerId, expiresAt: new Date(Date.now() + 86_400_000) }
  })

  return { game, faction, character, intrigue, item, location, document, timelineEvent, participant, session, registrationPeriod, photo, rib, invitation }
}

export async function createWorld(prisma: PrismaClient) {
  const user = (key: string, role = 'organizer') => prisma.user.create({
    data: { email: `${key}@example.test`, name: key, password: 'non-utilise', role }
  })
  const alice = await user('alice')
  const bob = await user('bob')
  // Carol est co-organisatrice du jeu de Bob : elle doit y avoir accès, mais pas aux droits de propriétaire
  const carol = await user('carol')
  const admin = await user('admin', 'admin')

  const a = await createGameWorld(prisma, 'a', alice.id)
  const b = await createGameWorld(prisma, 'b', bob.id)
  await prisma.gameShare.create({ data: { gameId: b.game.id, userId: carol.id } })

  return { users: { alice, bob, carol, admin }, a, b }
}
