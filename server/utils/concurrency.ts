import { prisma } from '~/server/utils/prisma'

// Version lue par le client (ADR-0036) : la date de l'en-tête If-Unmodified-Since, ou null sans en-tête
function readVersion(event: any) {
  const raw = getHeader(event, 'if-unmodified-since')
  if (!raw) return null

  const since = new Date(Array.isArray(raw) ? raw[0] : raw)
  return Number.isNaN(since.getTime()) ? null : since
}

/**
 * Refuse l'écriture (409) si la version actuelle est plus récente que la version lue. Une version absente
 * (ligne pas encore créée) vaut la date zéro. Sans en-tête, rien n'est contrôlé.
 */
export function assertVersion(event: any, current: Date | string | null | undefined) {
  const since = readVersion(event)
  if (!since) return

  if ((current ? new Date(current).getTime() : 0) > since.getTime()) {
    throw createError({
      statusCode: 409,
      // En ligne comme au retour du mode hors ligne : la version lue n'est plus la dernière (ADR-0028)
      message: 'Cet élément a été modifié par quelqu’un d’autre entre-temps. Rechargez la page pour voir ses changements ; les vôtres n’ont pas été enregistrés.',
      // Distingue un conflit de version d'un autre refus 409 (resynchronisation, ADR-0036)
      data: { conflict: true }
    })
  }
}

export async function assertUnmodifiedSince(event: any, model: string, id: string) {
  if (!readVersion(event)) return

  const record = await (prisma as any)[model].findUnique({
    where: { id },
    select: { updatedAt: true }
  })

  if (!record?.updatedAt) return
  assertVersion(event, record.updatedAt)
}

// Paiement d'une personne : sa ligne fait version, à part de celle de la session (ADR-0036)
export async function assertPaymentUnmodifiedSince(event: any, sessionId: string, participantId: string) {
  if (!readVersion(event)) return

  const payment = await prisma.sessionPayment.findUnique({
    where: { sessionId_participantId: { sessionId, participantId } },
    select: { updatedAt: true }
  })
  assertVersion(event, payment?.updatedAt)
}
