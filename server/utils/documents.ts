import { prisma } from '~/server/utils/prisma'

export const documentInclude = {
  game: true,
  character: true,
  characters: {
    orderBy: [{ type: 'asc' as const }, { name: 'asc' as const }]
  },
  factions: {
    include: {
      characters: {
        orderBy: [{ type: 'asc' as const }, { name: 'asc' as const }]
      }
    },
    orderBy: { name: 'asc' as const }
  }
}

export async function validateDocumentRelations(gameId: string, characterId?: string | null, characterIds: string[] = [], factionIds: string[] = []) {
  const allCharacterIds = [...new Set([
    ...(characterId ? [characterId] : []),
    ...characterIds
  ])]

  if (allCharacterIds.length) {
    const count = await prisma.character.count({
      where: { id: { in: allCharacterIds }, gameId }
    })
    if (count !== allCharacterIds.length) {
      throw createError({ statusCode: 400, statusMessage: 'Personnages invalides pour ce jeu' })
    }
  }

  if (factionIds.length) {
    const count = await prisma.faction.count({
      where: { id: { in: factionIds }, gameId }
    })
    if (count !== factionIds.length) {
      throw createError({ statusCode: 400, statusMessage: 'Groupes invalides pour ce jeu' })
    }
  }
}

export async function getSessionDocumentDashboard(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      game: true,
      participants: {
        include: { participant: true }
      },
      assignments: {
        include: {
          character: true,
          participant: true
        }
      }
    }
  })

  if (!session) {
    throw createError({ statusCode: 404, statusMessage: 'Session introuvable' })
  }

  const [documents, deliveries] = await Promise.all([
    prisma.document.findMany({
      where: { gameId: session.gameId },
      orderBy: [{ updatedAt: 'desc' }, { title: 'asc' }],
      include: documentInclude
    }),
    prisma.sessionDocumentDelivery.findMany({
      where: { sessionId: session.id },
      include: {
        participant: true,
        document: true,
        character: true
      }
    })
  ])

  const castByCharacterId = new Map(
    session.assignments
      .filter((assignment) => assignment.participantId)
      .map((assignment) => [assignment.characterId, assignment])
  )

  const castRecipients = session.assignments
    .filter((assignment) => assignment.participantId && assignment.participant)
    .map((assignment) => ({
      participant: assignment.participant!,
      character: assignment.character,
      targetLabel: assignment.character.name
    }))

  const organizerRecipients = session.participants
    .filter((sessionParticipant) => sessionParticipant.role === 'organizer')
    .map((sessionParticipant) => ({
      participant: sessionParticipant.participant,
      character: null,
      targetLabel: 'Organisateur'
    }))

  const npcRecipients = session.participants
    .filter((sessionParticipant) => sessionParticipant.role === 'npc')
    .map((sessionParticipant) => ({
      participant: sessionParticipant.participant,
      character: null,
      targetLabel: 'PNJ de session'
    }))

  const uniqueRecipients = (recipients: Array<{
    participant: { id: string }
    character: { id: string, name: string } | null
    targetLabel: string
  }>) => {
    const byParticipantId = new Map<string, typeof recipients[number]>()
    for (const recipient of recipients) {
      byParticipantId.set(recipient.participant.id, recipient)
    }
    return [...byParticipantId.values()]
  }

  const documentsWithRecipients = documents.map((document) => {
    const baseRecipients = (() => {
      if (document.audience === 'everyone') {
        return uniqueRecipients([...castRecipients, ...organizerRecipients, ...npcRecipients])
      }
      if (document.audience === 'organizers') return organizerRecipients
      if (document.audience === 'npcs') return npcRecipients

      const targetCharacterIds = new Set<string>()
      if (document.characterId) {
        targetCharacterIds.add(document.characterId)
      }
      for (const character of document.characters || []) {
        targetCharacterIds.add(character.id)
      }

      for (const faction of document.factions || []) {
        for (const character of faction.characters || []) {
          targetCharacterIds.add(character.id)
        }
      }

      return [...targetCharacterIds].flatMap((characterId) => {
        const assignment = castByCharacterId.get(characterId)
        if (!assignment?.participantId || !assignment.participant) return []

        return [{
          participant: assignment.participant,
          character: assignment.character,
          targetLabel: assignment.character.name
        }]
      })
    })()

    const recipients = baseRecipients.map((recipient) => {
      const delivery = deliveries.find((item) =>
        item.kind === 'document'
        && item.documentId === document.id
        && item.participantId === recipient.participant.id
      )

      return {
        ...recipient,
        sentAt: delivery?.sentAt || null
      }
    })

    return {
      ...document,
      recipients
    }
  })

  const characterSheets = session.assignments
    .filter((assignment) => assignment.participantId && assignment.participant)
    .map((assignment) => {
      const delivery = deliveries.find((item) =>
        item.kind === 'character_sheet'
        && item.characterId === assignment.characterId
        && item.participantId === assignment.participantId
      )

      return {
        character: assignment.character,
        participant: assignment.participant,
        hasExternalDocument: Boolean(assignment.character.backgroundDocumentUrl),
        sentAt: delivery?.sentAt || null
      }
    })

  const sessionRoleRecipients = session.participants
    .filter((sessionParticipant) => sessionParticipant.role === 'organizer' || sessionParticipant.role === 'npc')
    .map((sessionParticipant) => ({
      role: sessionParticipant.role,
      participant: sessionParticipant.participant
    }))

  return {
    session,
    documents: documentsWithRecipients,
    characterSheets,
    sessionRoleRecipients
  }
}

export async function markDocumentDeliveries(sessionId: string, documentIds: string[]) {
  const dashboard = await getSessionDocumentDashboard(sessionId)
  const selectedIds = new Set(documentIds)
  const documents = dashboard.documents.filter((document) => selectedIds.has(document.id))
  const created: Array<{ documentId: string, participantId: string }> = []

  for (const document of documents) {
    for (const recipient of document.recipients) {
      if (recipient.sentAt) continue

      const exists = await prisma.sessionDocumentDelivery.findFirst({
        where: {
          sessionId,
          documentId: document.id,
          participantId: recipient.participant.id,
          kind: 'document'
        }
      })
      if (exists) continue

      await prisma.sessionDocumentDelivery.create({
        data: {
          sessionId,
          documentId: document.id,
          participantId: recipient.participant.id,
          kind: 'document'
        }
      })
      created.push({ documentId: document.id, participantId: recipient.participant.id })
    }
  }

  return { sentCount: created.length }
}

export async function markCharacterSheetDeliveries(sessionId: string) {
  const dashboard = await getSessionDocumentDashboard(sessionId)
  let sentCount = 0

  for (const sheet of dashboard.characterSheets) {
    if (!sheet.participant?.id || !sheet.character?.id || sheet.sentAt) continue

    const exists = await prisma.sessionDocumentDelivery.findFirst({
      where: {
        sessionId,
        participantId: sheet.participant.id,
        characterId: sheet.character.id,
        kind: 'character_sheet'
      }
    })
    if (exists) continue

    await prisma.sessionDocumentDelivery.create({
      data: {
        sessionId,
        participantId: sheet.participant.id,
        characterId: sheet.character.id,
        kind: 'character_sheet'
      }
    })
    sentCount++
  }

  return { sentCount }
}
