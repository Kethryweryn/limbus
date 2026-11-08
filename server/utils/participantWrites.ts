import type { H3Event } from 'h3'
import type { z } from 'zod'
import { prisma } from '~/server/utils/prisma'
import { accessibleGameIds, requireCurrentUser, requireParticipantAccess } from '~/server/utils/gameAccess'
import type { participantCreateSchema, participantSchema } from '~/server/utils/schemas'
import { exposeParticipantGames, participantGameLinksInclude, planParticipantRemoval } from '~/server/utils/participants'
import { eraseParticipant } from '~/server/utils/participantPrivacy'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'
import { accountIdForEmail, syncProfileToParticipants } from '~/server/utils/participantAccounts'

// Écritures d'une fiche participant, communes aux routes de l'interface et aux outils des assistants d'IA (US-129,
// SPEC-014 R12) : mêmes contrôles d'accès aux jeux, de version et de rattachement au compte de l'adresse

type Reader<S extends z.ZodType> = () => Promise<z.output<S>>

const sameAddress = (left: string | null | undefined, right: string | null | undefined) =>
  (left?.trim().toLowerCase() || null) === (right?.trim().toLowerCase() || null)

/**
 * Une seule fiche par adresse dans les jeux de l'équipe (SPEC-007, R5, US-185) : une autre fiche de ses jeux avec la
 * même adresse refuse la création ou le changement d'email, en la désignant pour que l'équipe lui ajoute le jeu.
 */
async function assertNoOtherFiche(email: string | null | undefined, gameIds: string[] | null, exceptId?: string) {
  const address = email?.trim()
  if (!address) return
  const other = await prisma.participant.findFirst({
    where: {
      email: { equals: address, mode: 'insensitive' },
      ...(exceptId ? { id: { not: exceptId } } : {}),
      ...(gameIds === null ? {} : { gameLinks: { some: { gameId: { in: gameIds } } } })
    },
    select: { id: true, slug: true, name: true }
  })
  if (other) {
    throw createError({
      statusCode: 409,
      message: `Une fiche existe déjà pour cette adresse dans vos jeux : ${other.name}. Ajoutez-lui ce jeu depuis sa fiche.`,
      data: { existingParticipant: other }
    })
  }
}

export async function createParticipant(event: H3Event, readBody: Reader<typeof participantCreateSchema>) {
  const body = await readBody()
  const { name, email, phone, gameNotes, gameIds } = body
  const uniqueGameIds = [...new Set(gameIds)]
  const allowedGameIds = await accessibleGameIds(event)
  // Jeux liés et notes par jeu (US-069) : tous doivent être accessibles
  if (allowedGameIds !== null && [...uniqueGameIds, ...Object.keys(gameNotes)].some((gameId) => !allowedGameIds.includes(gameId))) {
    throw createError({ statusCode: 403, message: 'Jeu inaccessible' })
  }
  await assertNoOtherFiche(email, allowedGameIds)

  const participant = await prisma.participant.create({
    data: {
      name,
      slug: await generateUniqueSlug('participant', name),
      email: email || null,
      phone: phone || null,
      // Rattachée au compte de son adresse (US-070)
      userId: await accountIdForEmail(email),
      gameLinks: {
        create: uniqueGameIds.map((gameId) => ({ gameId, notes: gameNotes[gameId] || null }))
      }
    },
    include: participantGameLinksInclude(allowedGameIds)
  })

  // Fiche rattachée dès sa création : elle prend les coordonnées du compte (US-074)
  if (participant.userId) await syncProfileToParticipants(participant.userId)
  return exposeParticipantGames(participant.userId ? await prisma.participant.findUniqueOrThrow({ where: { id: participant.id }, include: participantGameLinksInclude(allowedGameIds) }) : participant)
}

export async function updateParticipant(event: H3Event, id: string, readBody: Reader<typeof participantSchema>) {
  const user = await requireCurrentUser(event)
  await requireParticipantAccess(event, id)

  const body = await readBody()
  const { name, email, phone, gameNotes, gameIds } = body
  const uniqueGameIds = [...new Set(gameIds)]
  const allowedGameIds = await accessibleGameIds(event)
  // Jeux liés et notes par jeu (US-069) : tous doivent être accessibles
  if (allowedGameIds !== null && [...uniqueGameIds, ...Object.keys(gameNotes)].some((gameId) => !allowedGameIds.includes(gameId))) {
    throw createError({ statusCode: 403, message: 'Jeu inaccessible' })
  }

  await assertUnmodifiedSince(event, 'participant', id)
  // Seulement si l'adresse change : un doublon plus ancien reste modifiable
  const before = await prisma.participant.findUniqueOrThrow({ where: { id }, select: { email: true } })
  if (!sameAddress(before.email, email)) await assertNoOtherFiche(email, allowedGameIds, id)

  const existingLinks = await prisma.participantGame.findMany({
    where: { participantId: id },
    select: { gameId: true }
  })
  const existingGameIds = new Set(existingLinks.map((link) => link.gameId))
  const nextGameIds = new Set(uniqueGameIds)
  const managedExistingGameIds = allowedGameIds === null
    ? existingLinks.map((link) => link.gameId)
    : existingLinks.map((link) => link.gameId).filter((gameId) => allowedGameIds.includes(gameId))

  const gameIdsToRemove = managedExistingGameIds.filter((gameId) => !nextGameIds.has(gameId))
  const gameIdsToAdd = uniqueGameIds.filter((gameId) => !existingGameIds.has(gameId))

  // Retirer un jeu retire aussi la personne de ses sessions (US-035) : dans la même transaction que la fiche, pour
  // qu'un échec de la mise à jour ne laisse pas les jeux retirés
  const removal = await planParticipantRemoval(id, gameIdsToRemove, user)
  const result = await prisma.$transaction(async (tx) => {
    await removal.apply(tx)
    // Une fiche sans aucun jeu est supprimée (US-036) : l'interface l'a fait confirmer
    if (!gameIdsToAdd.length && !await tx.participantGame.count({ where: { participantId: id } })) return null

    // Fiche qui reste rattachée : nom et téléphone sont tenus par la personne, l'envoi de l'équipe est ignoré (US-075)
    const userId = await accountIdForEmail(email)
    const current = await tx.participant.findUniqueOrThrow({ where: { id }, select: { name: true, phone: true, userId: true } })
    const heldByPerson = Boolean(userId && userId === current.userId)
    const effectiveName = heldByPerson ? current.name : name
    const updated = await tx.participant.update({
      where: { id },
      data: {
        name: effectiveName,
        slug: await generateUniqueSlug('participant', effectiveName, id),
        email: email || null,
        phone: heldByPerson ? current.phone : phone || null,
        // Le rattachement suit l'adresse : autre compte, ou aucun (US-070)
        userId,
        gameLinks: {
          create: gameIdsToAdd.map((gameId) => ({ gameId, notes: gameNotes[gameId] || null })),
          // Note de chaque jeu déjà lié et reçu ; les notes des autres jeux ne bougent pas (US-069)
          updateMany: Object.entries(gameNotes)
            .filter(([gameId]) => existingGameIds.has(gameId) && nextGameIds.has(gameId))
            .map(([gameId, text]) => ({ where: { gameId }, data: { notes: text || null } }))
        }
      },
      include: participantGameLinksInclude(allowedGameIds)
    })
    return { updated, newlyLinkedUserId: userId && !heldByPerson ? userId : null }
  })
  await removal.afterCommit()

  if (!result) {
    await eraseParticipant(id)
    return { deleted: true }
  }

  // Rattachée par ce changement d'email : elle prend les coordonnées du compte (US-074)
  const { updated: participant, newlyLinkedUserId } = result
  if (newlyLinkedUserId) {
    await syncProfileToParticipants(newlyLinkedUserId)
    return exposeParticipantGames(await prisma.participant.findUniqueOrThrow({ where: { id }, include: participantGameLinksInclude(allowedGameIds) }))
  }
  return exposeParticipantGames(participant)
}
