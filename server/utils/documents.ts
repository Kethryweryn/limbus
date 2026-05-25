import { prisma } from '~/server/utils/prisma'
import { sendEmail } from '~/server/utils/email'
import { DOCUMENT_AUDIENCES, SESSION_ROLES } from '~/utils/domain'
import { generatedPdfFileName, renderTextPdf } from '~/server/utils/generatedPdfs'

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
      throw createError({ statusCode: 400, message: 'Personnages invalides pour ce jeu' })
    }
  }

  if (factionIds.length) {
    const count = await prisma.faction.count({
      where: { id: { in: factionIds }, gameId }
    })
    if (count !== factionIds.length) {
      throw createError({ statusCode: 400, message: 'Groupes invalides pour ce jeu' })
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
    throw createError({ statusCode: 404, message: 'Session introuvable' })
  }

  const [documents, deliveries, trombinoscopes] = await Promise.all([
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
    }),
    prisma.sessionTrombinoscope.findMany({
      where: { sessionId: session.id },
      include: {
        viewerCharacter: true,
        participant: true
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
    .filter((sessionParticipant) => sessionParticipant.role === SESSION_ROLES.organizer)
    .map((sessionParticipant) => ({
      participant: sessionParticipant.participant,
      character: null,
      targetLabel: 'Organisateur'
    }))

  const npcRecipients = session.participants
    .filter((sessionParticipant) => sessionParticipant.role === SESSION_ROLES.npc)
    .map((sessionParticipant) => ({
      participant: sessionParticipant.participant,
      character: null,
      targetLabel: 'PNJ de session'
    }))

  const kitchenRecipients = session.participants
    .filter((sessionParticipant) => sessionParticipant.role === SESSION_ROLES.kitchen)
    .map((sessionParticipant) => ({
      participant: sessionParticipant.participant,
      character: null,
      targetLabel: 'Équipe cuisine'
    }))

  const uniqueRecipients = (recipients: Array<{
    participant: { id: string }
    character: { id: string, name: string } | null
    targetLabel: string
  }>) => {
    const byParticipantId = new Map<string, typeof recipients[number]>()
    for (const recipient of recipients) {
      if (!byParticipantId.has(recipient.participant.id)) {
        byParticipantId.set(recipient.participant.id, recipient)
      }
    }
    return [...byParticipantId.values()]
  }

  const documentsWithRecipients = documents.map((document) => {
    const baseRecipients = (() => {
      if (document.audience === DOCUMENT_AUDIENCES.everyone) {
        return uniqueRecipients([...castRecipients, ...organizerRecipients, ...npcRecipients, ...kitchenRecipients])
      }
      if (document.audience === DOCUMENT_AUDIENCES.organizers) return organizerRecipients
      if (document.audience === DOCUMENT_AUDIENCES.npcs) return npcRecipients
      if (document.audience === DOCUMENT_AUDIENCES.kitchen) return kitchenRecipients

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
      recipients,
      pdfUrl: `/api/sessions/${session.id}/documents/${document.id}/pdf`
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
      const trombinoscopeDelivery = deliveries.find((item) =>
        item.kind === 'trombinoscope'
        && item.characterId === assignment.characterId
        && item.participantId === assignment.participantId
      )
      const bundleDelivery = deliveries.find((item) =>
        item.kind === 'character_sheet_bundle'
        && item.characterId === assignment.characterId
        && item.participantId === assignment.participantId
      )
      const generatedTrombinoscope = trombinoscopes.find((item) =>
        item.viewerCharacterId === assignment.characterId
        && item.participantId === assignment.participantId
      )
      const inferredBundleSentAt = delivery?.sentAt && trombinoscopeDelivery?.sentAt
        ? new Date(Math.max(new Date(delivery.sentAt).getTime(), new Date(trombinoscopeDelivery.sentAt).getTime()))
        : null

      return {
        character: assignment.character,
        participant: assignment.participant,
        hasExternalDocument: Boolean(assignment.character.backgroundDocumentUrl),
        readyToSend: Boolean(assignment.character.sheetReadyToSend),
        sentAt: delivery?.sentAt || null,
        trombinoscopeSentAt: trombinoscopeDelivery?.sentAt || null,
        bundleSentAt: bundleDelivery?.sentAt || inferredBundleSentAt,
        trombinoscopeGeneratedAt: generatedTrombinoscope?.generatedAt || null,
        trombinoscopeMissingPhotos: generatedTrombinoscope?.missingPhotos || 0,
        characterSheetPdfUrl: `/api/sessions/${session.id}/documents/character-sheets/${assignment.characterId}/pdf`,
        trombinoscopeUrl: generatedTrombinoscope
          ? `/api/sessions/${session.id}/trombinoscopes/${assignment.characterId}`
          : null
      }
    })

  const sessionRoleRecipients = session.participants
    .filter((sessionParticipant) =>
      sessionParticipant.role === SESSION_ROLES.organizer
      || sessionParticipant.role === SESSION_ROLES.npc
      || sessionParticipant.role === SESSION_ROLES.kitchen
    )
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

function assertSent(result: Awaited<ReturnType<typeof sendEmail>>) {
  if (!result.sent) {
    throw createError({ statusCode: 500, message: 'SMTP désactivé' })
  }
}

export async function markDocumentDeliveries(sessionId: string, documentIds: string[]) {
  const dashboard = await getSessionDocumentDashboard(sessionId)
  const selectedIds = new Set(documentIds)
  const documents = dashboard.documents.filter((document) => selectedIds.has(document.id) && document.readyToSend)
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
      if (!recipient.participant.email) continue

      const result = await sendEmail({
        to: recipient.participant.email,
        subject: document.title,
        text: [
          `Bonjour ${recipient.participant.name.split(/\s+/)[0] || recipient.participant.name},`,
          '',
          document.content || '',
          document.documentUrl ? `Document lié : ${document.documentUrl}` : ''
        ].filter(Boolean).join('\n'),
        attachments: [
          await buildDocumentPdfAttachment(dashboard.session, document)
        ]
      })
      assertSent(result)

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
    if (!sheet.participant?.id || !sheet.character?.id || !sheet.readyToSend || sheet.sentAt) continue
    if (!sheet.participant.email) continue

    const exists = await prisma.sessionDocumentDelivery.findFirst({
      where: {
        sessionId,
        participantId: sheet.participant.id,
        characterId: sheet.character.id,
        kind: 'character_sheet'
      }
    })
    if (exists) continue

    const result = await sendEmail({
      to: sheet.participant.email,
      subject: `Fiche personnage - ${sheet.character.name}`,
      text: [
        `Bonjour ${sheet.participant.name.split(/\s+/)[0] || sheet.participant.name},`,
        '',
        `Voici ta fiche pour ${dashboard.session.name}.`,
        '',
        `Personnage : ${sheet.character.name}`,
        sheet.character.backgroundDocumentUrl
          ? `Fiche liée : ${sheet.character.backgroundDocumentUrl}`
          : sheet.character.background || ''
      ].filter(Boolean).join('\n'),
      attachments: [
        await buildCharacterSheetPdfAttachment(dashboard.session, sheet.character)
      ]
    })
    assertSent(result)

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

async function upsertDelivery(data: {
  sessionId: string
  participantId: string
  characterId: string
  kind: string
  force?: boolean
}) {
  const existing = await prisma.sessionDocumentDelivery.findFirst({
    where: {
      sessionId: data.sessionId,
      participantId: data.participantId,
      characterId: data.characterId,
      kind: data.kind
    },
    orderBy: { sentAt: 'desc' }
  })

  if (existing) {
    if (!data.force) return false

    await prisma.sessionDocumentDelivery.update({
      where: { id: existing.id },
      data: { sentAt: new Date() }
    })
    return true
  }

  await prisma.sessionDocumentDelivery.create({
    data: {
      sessionId: data.sessionId,
      participantId: data.participantId,
      characterId: data.characterId,
      kind: data.kind
    }
  })
  return true
}

export async function markTrombinoscopeDeliveries(sessionId: string) {
  const dashboard = await getSessionDocumentDashboard(sessionId)
  let sentCount = 0

  for (const sheet of dashboard.characterSheets) {
    if (!sheet.participant?.id || !sheet.character?.id || !sheet.trombinoscopeGeneratedAt || sheet.trombinoscopeSentAt) continue
    if (!sheet.participant.email) continue

    const result = await sendEmail({
      to: sheet.participant.email,
      subject: `Trombinoscope - ${dashboard.session.name}`,
      text: [
        `Bonjour ${sheet.participant.name.split(/\s+/)[0] || sheet.participant.name},`,
        '',
        `Voici ton trombinoscope pour ${dashboard.session.name}.`,
        'Le PDF est joint à cet email.'
      ].filter(Boolean).join('\n'),
      attachments: [
        await buildTrombinoscopePdfAttachment(sessionId, sheet.character.id)
      ]
    })
    assertSent(result)

    const sent = await upsertDelivery({
      sessionId,
      participantId: sheet.participant.id,
      characterId: sheet.character.id,
      kind: 'trombinoscope'
    })
    if (sent) sentCount++
  }

  return { sentCount }
}

export async function markCharacterSheetBundleDeliveries(sessionId: string) {
  const dashboard = await getSessionDocumentDashboard(sessionId)
  let sheetSentCount = 0
  let trombinoscopeSentCount = 0
  let bundleSentCount = 0

  for (const sheet of dashboard.characterSheets) {
    if (!sheet.participant?.id || !sheet.character?.id || !sheet.readyToSend || !sheet.trombinoscopeGeneratedAt) continue
    if (!sheet.participant.email) continue

    const result = await sendEmail({
      to: sheet.participant.email,
      subject: `Fiche personnage et trombinoscope - ${dashboard.session.name}`,
      text: [
        `Bonjour ${sheet.participant.name.split(/\s+/)[0] || sheet.participant.name},`,
        '',
        `Voici ta fiche et ton trombinoscope pour ${dashboard.session.name}.`,
        '',
        `Personnage : ${sheet.character.name}`,
        sheet.character.backgroundDocumentUrl
          ? `Fiche liée : ${sheet.character.backgroundDocumentUrl}`
          : sheet.character.background || '',
        'Les PDF sont joints à cet email.'
      ].filter(Boolean).join('\n'),
      attachments: [
        await buildCharacterSheetPdfAttachment(dashboard.session, sheet.character),
        await buildTrombinoscopePdfAttachment(sessionId, sheet.character.id)
      ]
    })
    assertSent(result)

    const sheetSent = await upsertDelivery({
      sessionId,
      participantId: sheet.participant.id,
      characterId: sheet.character.id,
      kind: 'character_sheet',
      force: true
    })
    if (sheetSent) sheetSentCount++

    const trombinoscopeSent = await upsertDelivery({
      sessionId,
      participantId: sheet.participant.id,
      characterId: sheet.character.id,
      kind: 'trombinoscope',
      force: true
    })
    if (trombinoscopeSent) trombinoscopeSentCount++

    const bundleSent = await upsertDelivery({
      sessionId,
      participantId: sheet.participant.id,
      characterId: sheet.character.id,
      kind: 'character_sheet_bundle',
      force: true
    })
    if (bundleSent) bundleSentCount++
  }

  return { sheetSentCount, trombinoscopeSentCount, bundleSentCount }
}

export async function sendDocumentTestEmails(sessionId: string, documentIds: string[], emails: string[]) {
  const dashboard = await getSessionDocumentDashboard(sessionId)
  const selectedIds = new Set(documentIds)
  const documents = dashboard.documents.filter((document) => selectedIds.has(document.id))

  if (!documents.length) {
    throw createError({ statusCode: 400, message: 'Aucun document sélectionné' })
  }

  for (const document of documents) {
    const result = await sendEmail({
      to: emails,
      subject: `[Test] ${document.title}`,
      text: [
        `Document de test pour la session ${dashboard.session.name}.`,
        '',
        document.content || '',
        document.documentUrl ? `Document lié : ${document.documentUrl}` : ''
      ].filter(Boolean).join('\n'),
      attachments: [
        await buildDocumentPdfAttachment(dashboard.session, document)
      ]
    })
    if (!result.sent) {
      throw createError({ statusCode: 500, message: 'SMTP désactivé' })
    }
  }

  return { sentCount: emails.length * documents.length }
}

export async function sendCharacterSheetBundleTestEmail(sessionId: string, characterId: string, emails: string[]) {
  const dashboard = await getSessionDocumentDashboard(sessionId)
  const sheet = dashboard.characterSheets.find((item) => item.character.id === characterId)

  if (!sheet) {
    throw createError({ statusCode: 404, message: 'Fiche personnage introuvable pour cette session' })
  }

  const result = await sendEmail({
    to: emails,
    subject: `[Test] Fiche personnage - ${sheet.character.name}`,
    text: [
      `Fiche personnage de test pour ${dashboard.session.name}.`,
      '',
      `Personnage : ${sheet.character.name}`,
      sheet.character.backgroundDocumentUrl
        ? `Fiche liée : ${sheet.character.backgroundDocumentUrl}`
        : sheet.character.background || 'Aucun background saisi.',
      sheet.trombinoscopeUrl ? 'Trombinoscope joint à cet email.' : 'Trombinoscope non généré.'
    ].filter(Boolean).join('\n'),
    attachments: [
      await buildCharacterSheetPdfAttachment(dashboard.session, sheet.character),
      ...(sheet.trombinoscopeUrl ? [await buildTrombinoscopePdfAttachment(sessionId, sheet.character.id)] : [])
    ]
  })
  if (!result.sent) {
    throw createError({ statusCode: 500, message: 'SMTP désactivé' })
  }

  return { sentCount: emails.length }
}

export async function buildDocumentPdf(sessionId: string, documentId: string) {
  const dashboard = await getSessionDocumentDashboard(sessionId)
  const document = dashboard.documents.find((item) => item.id === documentId)
  if (!document) {
    throw createError({ statusCode: 404, message: 'Document introuvable pour cette session' })
  }

  return {
    filename: generatedPdfFileName([dashboard.session.name, document.title]),
    bytes: await renderTextPdf({
      title: document.title,
      subtitle: `${dashboard.session.name} - ${dashboard.session.game.title}`,
      sections: [
        { title: 'Contenu', body: document.content || 'Aucun corps de document renseigné.' },
        ...(document.documentUrl ? [{ title: 'Document lié', body: document.documentUrl }] : [])
      ]
    })
  }
}

export async function buildCharacterSheetPdf(sessionId: string, characterId: string) {
  const dashboard = await getSessionDocumentDashboard(sessionId)
  const sheet = dashboard.characterSheets.find((item) => item.character.id === characterId)
  if (!sheet) {
    throw createError({ statusCode: 404, message: 'Fiche personnage introuvable pour cette session' })
  }

  return {
    filename: generatedPdfFileName([dashboard.session.name, sheet.character.name, 'fiche-personnage']),
    bytes: await renderTextPdf({
      title: sheet.character.name,
      subtitle: `Fiche personnage - ${dashboard.session.name}`,
      sections: [
        { title: 'Pitch', body: sheet.character.pitch || '' },
        { title: 'Background', body: sheet.character.background || '' },
        ...(sheet.character.backgroundDocumentUrl ? [{ title: 'Document lié', body: sheet.character.backgroundDocumentUrl }] : []),
        { title: 'Indications costume', body: sheet.character.costumeIndications || '' }
      ]
    })
  }
}

async function buildDocumentPdfAttachment(session: { id: string }, document: { id: string }) {
  const pdf = await buildDocumentPdf(session.id, document.id)
  return {
    filename: pdf.filename,
    content: Buffer.from(pdf.bytes),
    contentType: 'application/pdf'
  }
}

async function buildCharacterSheetPdfAttachment(session: { id: string }, character: { id: string }) {
  const pdf = await buildCharacterSheetPdf(session.id, character.id)
  return {
    filename: pdf.filename,
    content: Buffer.from(pdf.bytes),
    contentType: 'application/pdf'
  }
}

async function buildTrombinoscopePdfAttachment(sessionId: string, characterId: string) {
  const trombinoscope = await prisma.sessionTrombinoscope.findFirst({
    where: { sessionId, viewerCharacterId: characterId }
  })
  if (!trombinoscope?.contentPdfBase64) {
    throw createError({ statusCode: 404, message: 'Trombinoscope PDF introuvable' })
  }

  return {
    filename: trombinoscope.fileName,
    content: Buffer.from(trombinoscope.contentPdfBase64, 'base64'),
    contentType: 'application/pdf'
  }
}
