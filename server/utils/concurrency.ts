import type { H3Event } from 'h3'
import type { Prisma } from '~/generated/prisma/client'
import { prisma } from '~/server/utils/prisma'
import { participantVersions } from '~/server/utils/participantValues'

// Version lue par le client (ADR-0036) : celle donnée par un outil d'assistant d'IA (SPEC-014, R10), sinon la date de
// l'en-tête If-Unmodified-Since, ou null sans en-tête
function readVersion(event: H3Event) {
  const given = event.context.writeVersion
  if (given) return given
  const raw = getHeader(event, 'if-unmodified-since')
  if (!raw) return null

  const since = new Date(Array.isArray(raw) ? raw[0] : raw)
  return Number.isNaN(since.getTime()) ? null : since
}

function versionConflict() {
  return createError({
    statusCode: 409,
    // En ligne comme au retour du mode hors ligne : la version lue n'est plus la dernière (ADR-0028)
    message: 'Cet élément a été modifié par quelqu’un d’autre entre-temps. Rechargez la page pour voir ses changements ; les vôtres n’ont pas été enregistrés.',
    // Distingue un conflit de version d'un autre refus 409 (resynchronisation, ADR-0036)
    data: { conflict: true }
  })
}

/**
 * Refuse l'écriture (409) si la version actuelle est plus récente que la version lue. Une version absente
 * (ligne pas encore créée) vaut la date zéro. Sans en-tête, rien n'est contrôlé.
 */
export function assertVersion(event: H3Event, current: Date | string | null | undefined) {
  const since = readVersion(event)
  if (!since) return

  if ((current ? new Date(current).getTime() : 0) > since.getTime()) {
    throw versionConflict()
  }
}

/**
 * Comme assertVersion, pour une liste remplacée d'un bloc dont la version est le plus récent `updatedAt` de ses lignes. Sans
 * ligne, il n'y a plus de date : une version lue non nulle veut dire que la liste a été vidée depuis (ADR-0062).
 */
export function assertRowsVersion(event: H3Event, latest: Date | null) {
  const since = readVersion(event)
  if (!latest && since && since.getTime() > 0) throw versionConflict()
  assertVersion(event, latest)
}

// Modèle du schéma, par le nom de son délégué (prisma.session…) ; seul un modèle qui a updatedAt fait version
type VersionedModel = Uncapitalize<Prisma.ModelName>
type VersionReader = { findUnique(args: { where: { id: string }, select: { updatedAt: true } }): Promise<{ updatedAt: Date } | null> }

export async function assertUnmodifiedSince(event: H3Event, model: VersionedModel, id: string) {
  if (!readVersion(event)) return

  // Chaque délégué a sa propre signature : on n'en garde que la lecture de updatedAt, commune à tous
  const record = await (prisma[model] as unknown as VersionReader).findUnique({
    where: { id },
    select: { updatedAt: true }
  })

  if (!record?.updatedAt) return
  assertVersion(event, record.updatedAt)
}

// Paiement d'une personne : sa ligne fait version, à part de celle de la session (ADR-0036)
export async function assertPaymentUnmodifiedSince(event: H3Event, sessionId: string, participantId: string) {
  if (!readVersion(event)) return

  const payment = await prisma.sessionPayment.findUnique({
    where: { sessionId_participantId: { sessionId, participantId } },
    select: { updatedAt: true }
  })
  assertVersion(event, payment?.updatedAt)
}

/**
 * Fiche participant : sa version, pour une équipe, est le plus récent `updatedAt` des liens qu'elle voit (ADR-0086).
 * Une modification par une autre équipe, sur ses propres jeux, ne la refuse donc pas, et rien ne trahit son activité.
 * `gameIds` : jeux visibles, ou null pour tous (mode administrateur).
 */
export async function assertParticipantUnmodifiedSince(event: H3Event, participantId: string, gameIds: string[] | null) {
  if (!readVersion(event)) return
  assertRowsVersion(event, (await participantVersions([participantId], gameIds)).get(participantId) ?? null)
}
