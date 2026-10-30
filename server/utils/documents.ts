import { createHash } from 'node:crypto'
import { prisma } from '~/server/utils/prisma'
import { openEmailTransport, sendEmail, type EmailTransport } from '~/server/utils/email'
import { DOCUMENT_AUDIENCES, SESSION_ROLES } from '~/utils/domain'
import { generatedPdfFileName, renderTextPdf, type TextPdfInput } from '~/server/utils/generatedPdfs'
import { currentTrombinoscopeFingerprints, getSessionTrombinoscope, isTrombinoscopeOutdated } from '~/server/utils/trombinoscopes'
import { copyData, expiredSessionIds, purgeExpiredCopies, textCopy, trombinoscopeCopy, type DeliveryCopy } from '~/server/utils/deliveryCopies'

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

// Empreinte de ce qu'un envoi contient (ADR-0031) : elle dit si la version reçue est dépassée
const contentHash = (parts: unknown[]) => createHash('sha256').update(JSON.stringify(parts)).digest('hex')

export function documentContentHash(
  session: { name: string, game: { title: string } },
  document: { title: string, content: string | null, documentUrl: string | null }
) {
  return contentHash([session.game.title, session.name, document.title, document.content || '', document.documentUrl || ''])
}

export function characterSheetContentHash(
  session: { name: string },
  character: { name: string, pitch: string | null, background: string | null, backgroundDocumentUrl: string | null, costumeIndications: string | null }
) {
  return contentHash([session.name, character.name, character.pitch || '', character.background || '', character.backgroundDocumentUrl || '', character.costumeIndications || ''])
}

// Version reçue dépassée : empreinte différente, ou, pour un envoi sans empreinte, source modifiée depuis l'envoi
export function isSentVersionOutdated(
  delivery: { sentAt: Date, contentHash: string | null } | null | undefined,
  currentHash: string | null | undefined,
  changedAt: Date | null | undefined
) {
  if (!delivery) return false
  if (delivery.contentHash) return delivery.contentHash !== currentHash
  return Boolean(changedAt && changedAt.getTime() > delivery.sentAt.getTime())
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

  const [documents, deliveries, trombinoscopes, trombinoscopeFingerprints] = await Promise.all([
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
    }),
    currentTrombinoscopeFingerprints(session.id)
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

  const uniqueRecipients = <Recipient extends { participant: { id: string } }>(recipients: Recipient[]) => {
    const byParticipantId = new Map<string, Recipient>()
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

    const currentHash = documentContentHash(session, document)
    const recipients = baseRecipients.map((recipient) => {
      const delivery = deliveries.find((item) =>
        item.kind === 'document'
        && item.documentId === document.id
        && item.participantId === recipient.participant.id
      )

      return {
        ...recipient,
        sentAt: delivery?.sentAt || null,
        versionOutdated: isSentVersionOutdated(delivery, currentHash, document.updatedAt)
      }
    })

    return {
      ...document,
      contentHash: currentHash,
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
      const sheetContentHash = characterSheetContentHash(session, assignment.character)
      const inferredBundleSentAt = delivery?.sentAt && trombinoscopeDelivery?.sentAt
        ? new Date(Math.max(new Date(delivery.sentAt).getTime(), new Date(trombinoscopeDelivery.sentAt).getTime()))
        : null

      return {
        character: assignment.character,
        // Filtré plus haut : chaque fiche a son participant
        participant: assignment.participant!,
        hasExternalDocument: Boolean(assignment.character.backgroundDocumentUrl),
        readyToSend: Boolean(assignment.character.sheetReadyToSend),
        sentAt: delivery?.sentAt || null,
        trombinoscopeSentAt: trombinoscopeDelivery?.sentAt || null,
        bundleSentAt: bundleDelivery?.sentAt || inferredBundleSentAt,
        trombinoscopeGeneratedAt: generatedTrombinoscope?.generatedAt || null,
        trombinoscopeMissingPhotos: generatedTrombinoscope?.missingPhotos || 0,
        // Ne correspond plus au casting, aux photos ou aux réglages (US-028, ADR-0030)
        trombinoscopeOutdated: generatedTrombinoscope ? isTrombinoscopeOutdated(generatedTrombinoscope, trombinoscopeFingerprints) : false,
        // Version reçue plus ancienne que l'actuelle : à renvoyer (US-030, ADR-0031)
        sheetContentHash,
        sheetVersionOutdated: isSentVersionOutdated(delivery, sheetContentHash, assignment.character.updatedAt),
        trombinoscopeContentHash: generatedTrombinoscope?.sourceHash ?? null,
        trombinoscopeVersionOutdated: generatedTrombinoscope
          ? isSentVersionOutdated(trombinoscopeDelivery, generatedTrombinoscope.sourceHash, generatedTrombinoscope.generatedAt)
          : false,
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
    sessionRoleRecipients,
    // Photos lues une fois par envoi pour les copies des trombinoscopes (ADR-0044)
    photoCache: new Map<string, Promise<Uint8Array | null>>()
  }
}

type EmailMessage = Parameters<EmailTransport['send']>[0]
type Copies = { document?: DeliveryCopy, character_sheet?: DeliveryCopy, trombinoscope?: DeliveryCopy }
type OutgoingMessage = Omit<EmailMessage, 'to'> & { copies: Copies }

/**
 * Envoie un email à chaque destinataire sur une seule connexion SMTP (US-029). Un échec, ou un PDF impossible
 * à produire, n'arrête pas les suivants : la personne est rendue dans `failures`. Si rien n'est parti à cause
 * d'échecs, l'envoi est en erreur, comme pour les paiements (R19). Ce qui est parti est enregistré avec sa
 * copie (US-078, ADR-0044).
 */
async function sendToEach<Target extends { participant: { name: string, email: string | null } }>(
  sessionId: string,
  targets: Target[],
  buildMessage: (target: Target) => Promise<OutgoingMessage>,
  record: (target: Target, copies: Copies) => Promise<void>
) {
  const failures: string[] = []
  let sentCount = 0
  if (!targets.length) return { sentCount, failures }
  // Les copies des sessions passées s'effacent avant d'en ajouter (US-080) ; une session déjà passée n'en garde pas
  await purgeExpiredCopies()
  const keepCopies = !(await expiredSessionIds([sessionId])).size

  const transport = await openEmailTransport().catch(() => null)
  if (!transport) {
    throw createError({ statusCode: 500, message: 'SMTP désactivé ou mal configuré' })
  }

  try {
    for (const target of targets) {
      let copies: Copies
      try {
        const { copies: built, ...message } = await buildMessage(target)
        copies = built
        await transport.send({ ...message, to: target.participant.email! })
      } catch {
        failures.push(target.participant.name)
        continue
      }
      await record(target, keepCopies ? copies : {})
      sentCount++
    }
  } finally {
    transport.close()
  }

  if (!sentCount && failures.length) {
    throw createError({ statusCode: 502, message: `Aucun email n’est parti (${failures.join(', ')}).` })
  }
  return { sentCount, failures }
}

type Dashboard = Awaited<ReturnType<typeof getSessionDocumentDashboard>>
type DashboardDocument = Dashboard['documents'][number]
type DashboardSheet = Dashboard['characterSheets'][number]
type Recipient = { name: string, email: string | null }

const greeting = (participant: Recipient) => `Bonjour ${participant.name.split(/\s+/)[0] || participant.name},`

// Renvoi d'une version à jour (US-030) : l'objet le dit, et le texte rappelle qu'elle remplace la précédente
function asUpdate(message: OutgoingMessage, update: boolean): OutgoingMessage {
  if (!update) return message
  const [first = '', ...rest] = (message.text || '').split('\n')
  return {
    ...message,
    subject: `Mise à jour : ${message.subject}`,
    text: [first, '', 'Voici une version mise à jour : elle remplace celle que tu as reçue.', ...rest].join('\n')
  }
}

async function documentMessage(dashboard: Dashboard, document: DashboardDocument, participant: Recipient, update = false) {
  const pdf = await buildDocumentPdfAttachment(dashboard.session, document)
  return asUpdate({
    subject: document.title,
    text: [
      greeting(participant),
      '',
      document.content || '',
      document.documentUrl ? `Document lié : ${document.documentUrl}` : ''
    ].filter(Boolean).join('\n'),
    attachments: [pdf.attachment],
    copies: { document: pdf.copy }
  }, update)
}

async function characterSheetMessage(dashboard: Dashboard, sheet: DashboardSheet, update = false) {
  const pdf = await buildCharacterSheetPdfAttachment(dashboard.session, sheet.character)
  return asUpdate({
    subject: `Fiche personnage - ${sheet.character.name}`,
    text: [
      greeting(sheet.participant),
      '',
      `Voici ta fiche pour ${dashboard.session.name}.`,
      '',
      `Personnage : ${sheet.character.name}`,
      sheet.character.backgroundDocumentUrl
        ? `Fiche liée : ${sheet.character.backgroundDocumentUrl}`
        : sheet.character.background || ''
    ].filter(Boolean).join('\n'),
    attachments: [pdf.attachment],
    copies: { character_sheet: pdf.copy }
  }, update)
}

async function trombinoscopeMessage(dashboard: Dashboard, sheet: DashboardSheet, update = false) {
  const pdf = await buildTrombinoscopePdfAttachment(dashboard.session, sheet.character.id, dashboard.photoCache)
  return asUpdate({
    subject: `Trombinoscope - ${dashboard.session.name}`,
    text: [
      greeting(sheet.participant),
      '',
      `Voici ton trombinoscope pour ${dashboard.session.name}.`,
      'Le PDF est joint à cet email.'
    ].join('\n'),
    attachments: [pdf.attachment],
    copies: { trombinoscope: pdf.copy }
  }, update)
}

// Un renvoi remplace la copie : seule la dernière version reçue est gardée (US-078)
async function recordDocumentDelivery(sessionId: string, documentId: string, participantId: string, contentHash: string, copy?: DeliveryCopy) {
  const existing = await prisma.sessionDocumentDelivery.findFirst({
    where: { sessionId, documentId, participantId, kind: 'document' },
    orderBy: { sentAt: 'desc' }
  })
  if (existing) {
    await prisma.sessionDocumentDelivery.update({ where: { id: existing.id }, data: { sentAt: new Date(), contentHash, ...copyData(copy) } })
    return
  }
  await prisma.sessionDocumentDelivery.create({ data: { sessionId, documentId, participantId, kind: 'document', contentHash, ...copyData(copy) } })
}

export async function markDocumentDeliveries(sessionId: string, documentIds: string[]) {
  const dashboard = await getSessionDocumentDashboard(sessionId)
  const selectedIds = new Set(documentIds)
  const documents = dashboard.documents.filter((document) => selectedIds.has(document.id) && document.readyToSend)
  // Les envois déjà faits sont dans le tableau de bord, chargé sous le verrou d'envoi de la session.
  // Reste à ne pas écrire deux fois au même participant dans cet envoi (plusieurs personnages par participant).
  const seen = new Set<string>()
  const targets = documents.flatMap((document) => document.recipients.flatMap((recipient) => {
    const key = `${document.id}:${recipient.participant.id}`
    if (recipient.sentAt || seen.has(key) || !recipient.participant.email) return []
    seen.add(key)
    return [{ document, participant: recipient.participant }]
  }))

  return await sendToEach(
    sessionId,
    targets,
    ({ document, participant }) => documentMessage(dashboard, document, participant),
    ({ document, participant }, copies) => recordDocumentDelivery(sessionId, document.id, participant.id, document.contentHash, copies.document)
  )
}

export async function markCharacterSheetDeliveries(sessionId: string) {
  const dashboard = await getSessionDocumentDashboard(sessionId)
  // Les envois déjà faits sont dans le tableau de bord (sheet.sentAt), chargé sous le verrou d'envoi.
  // Une fiche par personnage de la session (@@unique sessionId, characterId) : pas de doublon possible.
  const targets = dashboard.characterSheets.filter((sheet) => sheet.readyToSend && !sheet.sentAt && sheet.participant.email)

  return await sendToEach(
    sessionId,
    targets,
    (sheet) => characterSheetMessage(dashboard, sheet),
    (sheet, copies) => upsertDelivery({ sessionId, participantId: sheet.participant.id, characterId: sheet.character.id, kind: 'character_sheet', contentHash: sheet.sheetContentHash }, copies.character_sheet)
  )
}

// Dernier envoi d'un type à une personne pour un personnage : un renvoi met à jour sa date, son empreinte (ADR-0031)
// et sa copie (ADR-0044)
async function upsertDelivery(data: {
  sessionId: string
  participantId: string
  characterId: string
  kind: string
  contentHash: string | null
}, copy?: DeliveryCopy) {
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
    await prisma.sessionDocumentDelivery.update({
      where: { id: existing.id },
      data: { sentAt: new Date(), contentHash: data.contentHash, ...copyData(copy) }
    })
    return
  }

  await prisma.sessionDocumentDelivery.create({ data: { ...data, ...copyData(copy) } })
}

// Un trombinoscope périmé n'est jamais envoyé : il faut d'abord le générer à nouveau (US-028)
function assertNoOutdatedTrombinoscope(sheets: Array<{ trombinoscopeOutdated: boolean }>) {
  const outdated = sheets.filter((sheet) => sheet.trombinoscopeOutdated).length
  if (outdated) {
    throw createError({ statusCode: 409, message: `${outdated} trombinoscope(s) ne sont plus à jour : générez-les à nouveau avant de les envoyer.` })
  }
}

export async function markTrombinoscopeDeliveries(sessionId: string) {
  const dashboard = await getSessionDocumentDashboard(sessionId)
  const targets = dashboard.characterSheets.filter((sheet) => sheet.trombinoscopeGeneratedAt && !sheet.trombinoscopeSentAt && sheet.participant.email)
  assertNoOutdatedTrombinoscope(targets)

  return await sendToEach(
    sessionId,
    targets,
    (sheet) => trombinoscopeMessage(dashboard, sheet),
    (sheet, copies) => upsertDelivery({ sessionId, participantId: sheet.participant.id, characterId: sheet.character.id, kind: 'trombinoscope', contentHash: sheet.trombinoscopeContentHash }, copies.trombinoscope)
  )
}

export async function markCharacterSheetBundleDeliveries(sessionId: string) {
  const dashboard = await getSessionDocumentDashboard(sessionId)
  // Comme les autres envois : seulement aux destinataires qui n'ont pas encore reçu fiche et trombinoscope
  const targets = dashboard.characterSheets.filter((sheet) =>
    sheet.readyToSend && sheet.trombinoscopeGeneratedAt && !sheet.bundleSentAt && sheet.participant.email
  )
  assertNoOutdatedTrombinoscope(targets)

  return await sendToEach(sessionId, targets, async (sheet) => {
    const characterSheet = await buildCharacterSheetPdfAttachment(dashboard.session, sheet.character)
    const trombinoscope = await buildTrombinoscopePdfAttachment(dashboard.session, sheet.character.id, dashboard.photoCache)
    return {
      subject: `Fiche personnage et trombinoscope - ${dashboard.session.name}`,
    text: [
      greeting(sheet.participant),
      '',
      `Voici ta fiche et ton trombinoscope pour ${dashboard.session.name}.`,
      '',
      `Personnage : ${sheet.character.name}`,
      sheet.character.backgroundDocumentUrl
        ? `Fiche liée : ${sheet.character.backgroundDocumentUrl}`
        : sheet.character.background || '',
      'Les PDF sont joints à cet email.'
    ].filter(Boolean).join('\n'),
      attachments: [characterSheet.attachment, trombinoscope.attachment],
      copies: { character_sheet: characterSheet.copy, trombinoscope: trombinoscope.copy }
    }
  }, async (sheet, copies) => {
    const base = { sessionId, participantId: sheet.participant.id, characterId: sheet.character.id }
    await upsertDelivery({ ...base, kind: 'character_sheet', contentHash: sheet.sheetContentHash }, copies.character_sheet)
    await upsertDelivery({ ...base, kind: 'trombinoscope', contentHash: sheet.trombinoscopeContentHash }, copies.trombinoscope)
    await upsertDelivery({ ...base, kind: 'character_sheet_bundle', contentHash: null })
  })
}

/**
 * Renvoi de la version à jour (US-030, ADR-0031). Avec une personne (`participantId` pour un document,
 * `characterId` pour une fiche ou un trombinoscope), il part à elle si elle a déjà reçu l'envoi ; sinon il
 * part à toutes les personnes dont la version reçue est dépassée.
 */
export async function resendDeliveries(sessionId: string, request: {
  kind: 'document' | 'character_sheet' | 'trombinoscope'
  documentId?: string | null
  participantId?: string | null
  characterId?: string | null
}) {
  const dashboard = await getSessionDocumentDashboard(sessionId)

  if (request.kind === 'document') {
    const document = dashboard.documents.find((item) => item.id === request.documentId)
    if (!document) {
      throw createError({ statusCode: 404, message: 'Document introuvable pour cette session' })
    }
    if (!document.readyToSend) {
      throw createError({ statusCode: 409, message: 'Ce document n’est pas prêt à envoyer.' })
    }
    const seen = new Set<string>()
    const targets = document.recipients.filter((recipient) => {
      if (!recipient.sentAt || !recipient.participant.email || seen.has(recipient.participant.id)) return false
      if (request.participantId ? recipient.participant.id !== request.participantId : !recipient.versionOutdated) return false
      seen.add(recipient.participant.id)
      return true
    })
    return await sendToEach(
    sessionId,
      targets,
      (recipient) => documentMessage(dashboard, document, recipient.participant, true),
      (recipient, copies) => recordDocumentDelivery(sessionId, document.id, recipient.participant.id, document.contentHash, copies.document)
    )
  }

  const selected = (sheet: DashboardSheet, outdated: boolean) =>
    Boolean(sheet.participant.email) && (request.characterId ? sheet.character.id === request.characterId : outdated)

  if (request.kind === 'character_sheet') {
    const targets = dashboard.characterSheets.filter((sheet) => sheet.sentAt && sheet.readyToSend && selected(sheet, sheet.sheetVersionOutdated))
    return await sendToEach(
    sessionId,
      targets,
      (sheet) => characterSheetMessage(dashboard, sheet, true),
      (sheet, copies) => upsertDelivery({ sessionId, participantId: sheet.participant.id, characterId: sheet.character.id, kind: 'character_sheet', contentHash: sheet.sheetContentHash }, copies.character_sheet)
    )
  }

  const targets = dashboard.characterSheets.filter((sheet) =>
    sheet.trombinoscopeSentAt && sheet.trombinoscopeGeneratedAt && selected(sheet, sheet.trombinoscopeVersionOutdated)
  )
  assertNoOutdatedTrombinoscope(targets)
  return await sendToEach(
    sessionId,
    targets,
    (sheet) => trombinoscopeMessage(dashboard, sheet, true),
    (sheet, copies) => upsertDelivery({ sessionId, participantId: sheet.participant.id, characterId: sheet.character.id, kind: 'trombinoscope', contentHash: sheet.trombinoscopeContentHash }, copies.trombinoscope)
  )
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
        (await buildDocumentPdfAttachment(dashboard.session, document)).attachment
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

  // Le test montre ce qui partirait : un trombinoscope périmé ne part pas non plus (US-028)
  if (sheet.trombinoscopeUrl) assertNoOutdatedTrombinoscope([sheet])

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
      (await buildCharacterSheetPdfAttachment(dashboard.session, sheet.character)).attachment,
      ...(sheet.trombinoscopeUrl ? [(await buildTrombinoscopePdfAttachment(dashboard.session, sheet.character.id, null)).attachment] : [])
    ]
  })
  if (!result.sent) {
    throw createError({ statusCode: 500, message: 'SMTP désactivé' })
  }

  return { sentCount: emails.length }
}

// Ce que montre le PDF d'un document : repris tel quel dans sa copie (US-078) et pour sa lecture (US-079)
export function documentPdfContent(
  session: { name: string, game: { title: string } },
  document: { title: string, content: string | null, documentUrl: string | null }
): TextPdfInput {
  return {
    title: document.title,
    subtitle: `${session.name} - ${session.game.title}`,
    sections: [
      { title: 'Contenu', body: document.content || 'Aucun corps de document renseigné.' },
      ...(document.documentUrl ? [{ title: 'Document lié', body: document.documentUrl }] : [])
    ]
  }
}

export function characterSheetPdfContent(
  session: { name: string },
  character: { name: string, pitch: string | null, background: string | null, backgroundDocumentUrl: string | null, costumeIndications: string | null }
): TextPdfInput {
  return {
    title: character.name,
    subtitle: `Fiche personnage - ${session.name}`,
    sections: [
      { title: 'Pitch', body: character.pitch || '' },
      { title: 'Background', body: character.background || '' },
      ...(character.backgroundDocumentUrl ? [{ title: 'Document lié', body: character.backgroundDocumentUrl }] : []),
      { title: 'Indications costume', body: character.costumeIndications || '' }
    ]
  }
}

export async function buildDocumentPdf(sessionId: string, documentId: string) {
  const dashboard = await getSessionDocumentDashboard(sessionId)
  const document = dashboard.documents.find((item) => item.id === documentId)
  if (!document) {
    throw createError({ statusCode: 404, message: 'Document introuvable pour cette session' })
  }

  const content = documentPdfContent(dashboard.session, document)
  return {
    filename: generatedPdfFileName([dashboard.session.name, document.title]),
    content,
    bytes: await renderTextPdf(content)
  }
}

export async function buildCharacterSheetPdf(sessionId: string, characterId: string) {
  const dashboard = await getSessionDocumentDashboard(sessionId)
  const sheet = dashboard.characterSheets.find((item) => item.character.id === characterId)
  if (!sheet) {
    throw createError({ statusCode: 404, message: 'Fiche personnage introuvable pour cette session' })
  }

  const content = characterSheetPdfContent(dashboard.session, sheet.character)
  return {
    filename: generatedPdfFileName([dashboard.session.name, sheet.character.name, 'fiche-personnage']),
    content,
    bytes: await renderTextPdf(content)
  }
}

async function buildDocumentPdfAttachment(session: { id: string }, document: { id: string }) {
  const pdf = await buildDocumentPdf(session.id, document.id)
  return {
    attachment: { filename: pdf.filename, content: Buffer.from(pdf.bytes), contentType: 'application/pdf' },
    copy: textCopy(pdf.content, pdf.bytes)
  }
}

async function buildCharacterSheetPdfAttachment(session: { id: string }, character: { id: string }) {
  const pdf = await buildCharacterSheetPdf(session.id, character.id)
  return {
    attachment: { filename: pdf.filename, content: Buffer.from(pdf.bytes), contentType: 'application/pdf' },
    copy: textCopy(pdf.content, pdf.bytes)
  }
}

// photoCache null : pas de copie (email de test)
async function buildTrombinoscopePdfAttachment(session: { id: string, name: string }, characterId: string, photoCache: Map<string, Promise<Uint8Array | null>> | null) {
  const trombinoscope = await getSessionTrombinoscope(session.id, characterId)
  if (!trombinoscope.contentPdfBase64) {
    throw createError({ statusCode: 404, message: 'Trombinoscope PDF introuvable' })
  }

  return {
    attachment: {
      filename: trombinoscope.fileName,
      content: Buffer.from(trombinoscope.contentPdfBase64, 'base64'),
      contentType: 'application/pdf'
    },
    copy: photoCache ? await trombinoscopeCopy(trombinoscope, trombinoscopeHeading(session), photoCache) : undefined
  }
}

export function trombinoscopeHeading(session: { name: string }) {
  return { title: 'Trombinoscope', subtitle: session.name }
}
