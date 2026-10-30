import { prisma } from '~/server/utils/prisma'
import { myParticipantIds } from '~/server/utils/participantAccounts'
import { generatedPdfFileName, renderTextPdf, type TextPdfInput } from '~/server/utils/generatedPdfs'
import { characterSheetPdfContent, documentPdfContent } from '~/server/utils/documents'
import { COPY_KINDS, expiredSessionIds, imageContentType, trombinoscopeCards, type CopyContent } from '~/server/utils/deliveryCopies'
import { loadImageBytes } from '~/server/utils/trombinoscopes'

// Documents reçus, dans « Je participe » (US-079, ADR-0044) : tout part des envois aux fiches rattachées au compte

const deliverySelect = {
  id: true,
  kind: true,
  sentAt: true,
  sessionId: true,
  participantId: true,
  characterId: true,
  copySize: true,
  document: { select: { title: true, content: true, documentUrl: true, readyToSend: true } },
  character: { select: { name: true, pitch: true, background: true, backgroundDocumentUrl: true, costumeIndications: true, sheetReadyToSend: true } },
  session: { select: { name: true, game: { select: { title: true } } } }
} as const

type MyDelivery = NonNullable<Awaited<ReturnType<typeof findDelivery>>>

async function findDelivery(id: string) {
  return await prisma.sessionDocumentDelivery.findUnique({ where: { id }, select: deliverySelect })
}

export function deliveryTitle(delivery: { kind: string, document: { title: string } | null, character: { name: string } | null }) {
  if (delivery.kind === 'document') return delivery.document?.title ?? 'Document'
  if (delivery.kind === 'character_sheet') return `Fiche personnage : ${delivery.character?.name ?? ''}`.trim()
  return 'Trombinoscope'
}

// Envoi à une de mes fiches ; sinon 404, comme toute ressource d'une autre fiche (ADR-0041)
export async function requireMyDelivery(userId: string, id: string) {
  const [delivery, ids] = await Promise.all([findDelivery(id), myParticipantIds(userId)])
  if (!delivery || !ids.includes(delivery.participantId) || !(COPY_KINDS as readonly string[]).includes(delivery.kind)) {
    throw createError({ statusCode: 404, message: 'Document introuvable' })
  }
  return delivery
}

// Version actuelle validée, lue quand il n'y a pas (ou plus) de copie (US-080)
async function currentTrombinoscope(delivery: MyDelivery) {
  if (!delivery.characterId) return null
  return await prisma.sessionTrombinoscope.findUnique({
    where: { sessionId_viewerCharacterId_participantId: { sessionId: delivery.sessionId, viewerCharacterId: delivery.characterId, participantId: delivery.participantId } },
    select: { fileName: true, contentPdfBase64: true, contentJson: true }
  })
}

function currentText(delivery: MyDelivery): TextPdfInput | null {
  if (delivery.kind === 'document' && delivery.document?.readyToSend) return documentPdfContent(delivery.session, delivery.document)
  if (delivery.kind === 'character_sheet' && delivery.character?.sheetReadyToSend) return characterSheetPdfContent(delivery.session, delivery.character)
  return null
}

// La copie, si elle existe et que la session n'est pas passée ; sinon null
async function liveCopy(delivery: MyDelivery) {
  if (delivery.copySize === null) return null
  if ((await expiredSessionIds([delivery.sessionId])).size) return null
  return await prisma.sessionDocumentDelivery.findUnique({ where: { id: delivery.id }, select: { copyPdf: true, copyContent: true } })
}

const photoUrl = (deliveryId: string, index: number) => `/api/me/documents/${deliveryId}/photos/${index}`

export async function readMyDelivery(delivery: MyDelivery) {
  const base = {
    id: delivery.id,
    kind: delivery.kind,
    title: deliveryTitle(delivery),
    sentAt: delivery.sentAt,
    session: { name: delivery.session.name, gameTitle: delivery.session.game.title }
  }
  const copy = await liveCopy(delivery)
  if (copy) {
    const content = copy.copyContent as CopyContent | null
    if (content?.kind === 'trombinoscope') {
      return { ...base, source: 'copy' as const, text: null, cards: content.cards.map(({ photo, ...card }, index) => ({ ...card, photoUrl: photo === null ? null : photoUrl(delivery.id, index) })) }
    }
    return { ...base, source: 'copy' as const, text: content?.kind === 'text' ? { title: content.title, subtitle: content.subtitle ?? null, sections: content.sections } : null, cards: null }
  }

  if (delivery.kind === 'trombinoscope') {
    const trombinoscope = await currentTrombinoscope(delivery)
    if (!trombinoscope) return { ...base, source: null, text: null, cards: null }
    const cards = trombinoscopeCards(trombinoscope.contentJson)
    return { ...base, source: 'current' as const, text: null, cards: cards?.map(({ photoUrl: url, ...card }, index) => ({ ...card, photoUrl: url ? photoUrl(delivery.id, index) : null })) ?? null }
  }
  const text = currentText(delivery)
  return { ...base, source: text ? 'current' as const : null, text, cards: null }
}

export async function myDeliveryPdf(delivery: MyDelivery) {
  const copy = await liveCopy(delivery)
  const filename = delivery.kind === 'trombinoscope'
    ? generatedPdfFileName([delivery.session.name, 'trombinoscope'])
    : generatedPdfFileName([delivery.session.name, deliveryTitle(delivery)])
  if (copy?.copyPdf) return { filename, bytes: copy.copyPdf }

  if (delivery.kind === 'trombinoscope') {
    const trombinoscope = await currentTrombinoscope(delivery)
    if (trombinoscope?.contentPdfBase64) return { filename, bytes: Buffer.from(trombinoscope.contentPdfBase64, 'base64') }
  } else {
    const text = currentText(delivery)
    if (text) return { filename, bytes: await renderTextPdf(text) }
  }
  throw createError({ statusCode: 404, message: 'Ce document n’est plus disponible.' })
}

export async function myDeliveryPhoto(delivery: MyDelivery, index: number) {
  const copy = await liveCopy(delivery)
  let bytes: Uint8Array | null = null
  if (copy) {
    const content = copy.copyContent as CopyContent | null
    const photo = content?.kind === 'trombinoscope' ? content.cards[index]?.photo : null
    bytes = typeof photo === 'number' && content?.kind === 'trombinoscope' && content.photos[photo] ? Buffer.from(content.photos[photo]!, 'base64') : null
  } else if (delivery.kind === 'trombinoscope') {
    const url = trombinoscopeCards((await currentTrombinoscope(delivery))?.contentJson)?.[index]?.photoUrl
    bytes = url ? await loadImageBytes(url) : null
  }
  const contentType = bytes ? imageContentType(bytes) : null
  if (!bytes || !contentType) {
    throw createError({ statusCode: 404, message: 'Photo introuvable' })
  }
  return { bytes, contentType }
}

// Ce que chaque session de « Je participe » liste (US-079) : seulement ce qui est parti par email
export async function myDeliveriesBySession(participantIds: string[]) {
  const deliveries = await prisma.sessionDocumentDelivery.findMany({
    where: { participantId: { in: participantIds }, kind: { in: [...COPY_KINDS] } },
    orderBy: { sentAt: 'desc' },
    select: deliverySelect
  })
  const expired = await expiredSessionIds([...new Set(deliveries.filter((delivery) => delivery.copySize !== null).map((delivery) => delivery.sessionId))])
  const trombinoscopes = await prisma.sessionTrombinoscope.findMany({
    where: { participantId: { in: participantIds }, sessionId: { in: deliveries.filter((delivery) => delivery.kind === 'trombinoscope').map((delivery) => delivery.sessionId) } },
    select: { sessionId: true, viewerCharacterId: true, participantId: true }
  })
  const generated = new Set(trombinoscopes.map((item) => `${item.sessionId}:${item.viewerCharacterId}:${item.participantId}`))

  const bySession = new Map<string, Array<{ id: string, kind: string, title: string, sentAt: Date, available: boolean }>>()
  for (const delivery of deliveries) {
    const hasCopy = delivery.copySize !== null && !expired.has(delivery.sessionId)
    const current = delivery.kind === 'trombinoscope'
      ? generated.has(`${delivery.sessionId}:${delivery.characterId}:${delivery.participantId}`)
      : Boolean(currentText(delivery))
    const list = bySession.get(delivery.sessionId) ?? []
    list.push({ id: delivery.id, kind: delivery.kind, title: deliveryTitle(delivery), sentAt: delivery.sentAt, available: hasCopy || current })
    bySession.set(delivery.sessionId, list)
  }
  return bySession
}
