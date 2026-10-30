import { Prisma } from '../../generated/prisma/client'
import { prisma } from '~/server/utils/prisma'
import type { TextPdfInput } from '~/server/utils/generatedPdfs'
import { loadImageBytes, type TrombinoscopeCard } from '~/server/utils/trombinoscopes'
import { SESSION_STATUSES } from '~/utils/domain'

// Copies des envois et leur lecture dans « Je participe » (US-078 à US-080, ADR-0044)

export const COPY_KINDS = ['document', 'character_sheet', 'trombinoscope'] as const

type TextCopyContent = TextPdfInput & { kind: 'text' }
type TrombinoscopeCopyContent = {
  kind: 'trombinoscope'
  title: string
  subtitle: string
  // photo : position dans `photos`, null pour un visage caché ou une photo manquante
  cards: Array<Omit<TrombinoscopeCard, 'photoUrl'> & { photo: number | null }>
  photos: string[]
}
export type CopyContent = TextCopyContent | TrombinoscopeCopyContent

export type DeliveryCopy = { pdf: Uint8Array, content: CopyContent | null }

export function textCopy(input: TextPdfInput, pdf: Uint8Array): DeliveryCopy {
  return { pdf, content: { kind: 'text', ...input } }
}

// Les photos sont recopiées dans la copie : elle ne dépend plus d'aucun fichier (ADR-0044)
export async function trombinoscopeCopy(
  trombinoscope: { contentPdfBase64: string | null, contentJson: unknown },
  heading: { title: string, subtitle: string },
  // Une photo n'est lue qu'une fois pour tout l'envoi
  photoCache: Map<string, Promise<Uint8Array | null>> = new Map()
): Promise<DeliveryCopy> {
  const pdf = Buffer.from(trombinoscope.contentPdfBase64 || '', 'base64')
  const cards = trombinoscopeCards(trombinoscope.contentJson)
  if (!cards) return { pdf, content: null }
  const photos: string[] = []
  const copiedCards = []
  for (const { photoUrl, ...card } of cards) {
    if (photoUrl && !photoCache.has(photoUrl)) photoCache.set(photoUrl, loadImageBytes(photoUrl))
    const bytes = photoUrl ? await photoCache.get(photoUrl)! : null
    copiedCards.push({ ...card, photo: bytes && imageContentType(bytes) ? photos.push(Buffer.from(bytes).toString('base64')) - 1 : null })
  }
  return { pdf, content: { kind: 'trombinoscope', ...heading, cards: copiedCards, photos } }
}

export function trombinoscopeCards(value: unknown): TrombinoscopeCard[] | null {
  return Array.isArray(value) ? value as TrombinoscopeCard[] : null
}

export function copyData(copy: DeliveryCopy | null | undefined) {
  if (!copy) return {}
  const content = copy.content ? JSON.stringify(copy.content) : ''
  return {
    copyPdf: Buffer.from(copy.pdf),
    copyContent: copy.content ?? Prisma.DbNull,
    copySize: copy.pdf.byteLength + Buffer.byteLength(content)
  }
}

export const NO_COPY = { copyPdf: null, copyContent: Prisma.DbNull, copySize: null }

export function imageContentType(bytes: Uint8Array) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (Buffer.from(bytes.subarray(0, 4)).toString('latin1') === 'RIFF' && Buffer.from(bytes.subarray(8, 12)).toString('latin1') === 'WEBP') return 'image/webp'
  return null
}

const DAY = 24 * 60 * 60 * 1000

type SessionTiming = { id: string, date: Date | null, status: string, cancelledAt: Date | null, postponedToSessionId: string | null }

/**
 * Date d'effacement des copies d'une session (US-080) : le lendemain de sa date ; une session reportée suit
 * celle qui la remplace ; une session annulée, un mois après l'annulation. null : gardées (session sans date).
 */
export function copiesExpireAt(session: SessionTiming, sessionsById: Map<string, SessionTiming>): Date | null {
  const seen = new Set<string>()
  let current: SessionTiming | undefined = session
  while (current?.status === SESSION_STATUSES.postponed && current.postponedToSessionId && !seen.has(current.id)) {
    seen.add(current.id)
    current = sessionsById.get(current.postponedToSessionId)
  }
  if (!current || current.status === SESSION_STATUSES.postponed) return null
  if (current.status === SESSION_STATUSES.cancelled) {
    if (!current.cancelledAt) return null
    const expires = new Date(current.cancelledAt)
    expires.setMonth(expires.getMonth() + 1)
    return expires
  }
  return current.date ? new Date(current.date.getTime() + DAY) : null
}

const timingSelect = { id: true, date: true, status: true, cancelledAt: true, postponedToSessionId: true } as const

// Les sessions d'où partent ces sessions-ci et la chaîne de leurs reports
async function loadTimings(sessionIds: string[]) {
  const byId = new Map<string, SessionTiming>()
  let pending = [...new Set(sessionIds)]
  while (pending.length) {
    const found = await prisma.session.findMany({ where: { id: { in: pending } }, select: timingSelect })
    for (const session of found) byId.set(session.id, session)
    pending = found.map((session) => session.postponedToSessionId).filter((id): id is string => Boolean(id) && !byId.has(id!))
  }
  return byId
}

export async function expiredSessionIds(sessionIds: string[], now = new Date()) {
  const timings = await loadTimings(sessionIds)
  return new Set(sessionIds.filter((id) => {
    const session = timings.get(id)
    const expires = session ? copiesExpireAt(session, timings) : null
    return Boolean(expires && expires.getTime() <= now.getTime())
  }))
}

// Pas de tâche planifiée : appelé à chaque connexion et avant chaque envoi (ADR-0044)
export async function purgeExpiredCopies(now = new Date()) {
  const withCopies = await prisma.sessionDocumentDelivery.findMany({ where: { copySize: { not: null } }, distinct: ['sessionId'], select: { sessionId: true } })
  if (!withCopies.length) return 0
  const expired = await expiredSessionIds(withCopies.map((delivery) => delivery.sessionId), now)
  if (!expired.size) return 0
  const { count } = await prisma.sessionDocumentDelivery.updateMany({ where: { sessionId: { in: [...expired] }, copySize: { not: null } }, data: NO_COPY })
  return count
}
