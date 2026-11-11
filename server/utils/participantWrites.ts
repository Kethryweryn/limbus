import type { H3Event } from 'h3'
import type { z } from 'zod'
import { prisma, type PrismaTx } from '~/server/utils/prisma'
import { accessibleGameIds, requireCurrentUser, requireParticipantAccess } from '~/server/utils/gameAccess'
import type { participantCreateSchema, participantSchema } from '~/server/utils/schemas'
import { exposeParticipantGames, participantGameLinksInclude, planParticipantRemoval } from '~/server/utils/participants'
import { eraseParticipant } from '~/server/utils/participantPrivacy'
import { assertParticipantUnmodifiedSince } from '~/server/utils/concurrency'
import { generateUniqueSlug } from '~/server/utils/generateUniqueSlug'
import { accountIdForEmail, syncProfileToParticipants } from '~/server/utils/participantAccounts'
import { participantEmailMatchWhere } from '~/server/utils/registrations'

// Écritures d'une fiche participant, communes aux routes de l'interface et aux outils des assistants d'IA (US-129,
// SPEC-014 R12) : mêmes contrôles d'accès aux jeux, de version et de rattachement au compte de l'adresse

type Reader<S extends z.ZodType> = () => Promise<z.output<S>>

const sameAddress = (left: string | null | undefined, right: string | null | undefined) =>
  (left?.trim().toLowerCase() || null) === (right?.trim().toLowerCase() || null)

// Deux écritures de la même adresse passent l'une après l'autre : la seconde trouve la fiche de la première
async function lockAddress(tx: PrismaTx, address: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`participant-email:${address.toLowerCase()}`}))`
}

/**
 * Fiche qui porte déjà cette adresse (SPEC-007, R5, US-185) : cherchée comme pour une inscription, parmi les jeux de la
 * même propriétaire que l'un des jeux visés (`participantEmailMatchWhere`), même ceux que l'organisatrice ne voit pas.
 */
async function ficheForAddress(client: PrismaTx, address: string, gameIds: string[], exceptId?: string) {
  const games = await client.game.findMany({ where: { id: { in: gameIds } }, select: { id: true, ownerId: true } })
  if (!games.length) return null
  return await client.participant.findFirst({
    where: { OR: games.map((game) => participantEmailMatchWhere(game, address)), ...(exceptId ? { id: { not: exceptId } } : {}) },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, slug: true, name: true, phone: true, gameLinks: { select: { gameId: true, notes: true } } }
  })
}

/**
 * Création d'une fiche. Une adresse qui a déjà une fiche dans les jeux de la propriétaire n'en crée pas une deuxième :
 * les jeux demandés, avec leurs notes, s'ajoutent à la fiche existante, dont le nom et le téléphone ne changent pas
 * (`joinedExisting`). Chaque équipe n'en voit que ses jeux (US-185).
 */
export async function createParticipant(event: H3Event, readBody: Reader<typeof participantCreateSchema>) {
  const body = await readBody()
  const { name, email, phone, gameNotes, gameIds } = body
  const uniqueGameIds = [...new Set(gameIds)]
  const allowedGameIds = await accessibleGameIds(event)
  // Jeux liés et notes par jeu (US-069) : tous doivent être accessibles
  if (allowedGameIds !== null && [...uniqueGameIds, ...Object.keys(gameNotes)].some((gameId) => !allowedGameIds.includes(gameId))) {
    throw createError({ statusCode: 403, message: 'Jeu inaccessible' })
  }

  const address = email?.trim()
  const { id, userId, joinedExisting } = await prisma.$transaction(async (tx) => {
    if (address) {
      await lockAddress(tx, address)
      const existing = await ficheForAddress(tx, address, uniqueGameIds)
      if (existing) {
        const notesByGame = new Map(existing.gameLinks.map((link) => [link.gameId, link.notes]))
        await tx.participantGame.createMany({
          // Nom et téléphone de la fiche existante, qui ne changent pas (US-185) ; tenus par jeu (ADR-0086)
          data: uniqueGameIds.filter((gameId) => !notesByGame.has(gameId)).map((gameId) => ({ participantId: existing.id, gameId, notes: gameNotes[gameId] || null, name: existing.name, phone: existing.phone }))
        })
        // Jeu déjà lié : la note donnée s'ajoute à la sienne, sans l'effacer
        for (const gameId of uniqueGameIds.filter((gameId) => notesByGame.has(gameId))) {
          const added = gameNotes[gameId]?.trim()
          const current = notesByGame.get(gameId)?.trim()
          if (!added || added === current) continue
          await tx.participantGame.update({
            where: { participantId_gameId: { participantId: existing.id, gameId } },
            data: { notes: current ? `${current}\n\n${added}` : added }
          })
        }
        // Ses jeux ont changé : sa version aussi, pour l'équipe qui la modifierait en même temps (ADR-0028)
        await tx.participant.update({ where: { id: existing.id }, data: { updatedAt: new Date() } })
        return { id: existing.id, userId: null, joinedExisting: true }
      }
    }
    // Rattachée au compte de son adresse (US-070) ; slug et compte ne se calculent que pour une vraie création
    const accountId = await accountIdForEmail(email)
    const created = await tx.participant.create({
      data: {
        name,
        slug: await generateUniqueSlug('participant', name),
        email: email || null,
        phone: phone || null,
        userId: accountId,
        gameLinks: { create: uniqueGameIds.map((gameId) => ({ gameId, notes: gameNotes[gameId] || null, name, phone: phone || null })) }
      },
      select: { id: true }
    })
    return { id: created.id, userId: accountId, joinedExisting: false }
  })

  // Fiche rattachée dès sa création : elle prend les coordonnées du compte (US-074)
  if (userId) await syncProfileToParticipants(userId)
  const participant = await prisma.participant.findUniqueOrThrow({ where: { id }, include: participantGameLinksInclude(allowedGameIds) })
  return { ...exposeParticipantGames(participant), joinedExisting }
}

// Refus d'une adresse déjà portée par une autre fiche : son nom et son lien seulement si l'organisatrice voit l'un de ses jeux
function duplicateAddressError(other: { slug: string, name: string, gameLinks: Array<{ gameId: string }> }, allowedGameIds: string[] | null) {
  const visible = allowedGameIds === null || other.gameLinks.some((link) => allowedGameIds.includes(link.gameId))
  return visible
    ? createError({ statusCode: 409, message: `Cette adresse est déjà celle de la fiche de ${other.name}.`, data: { existingParticipant: { slug: other.slug, name: other.name } } })
    : createError({ statusCode: 409, message: 'Cette adresse est déjà celle d’une fiche, dans un autre jeu de la même propriétaire : demandez-lui d’y ajouter ce jeu.' })
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

  // Version des liens que voit l'équipe (ADR-0086)
  await assertParticipantUnmodifiedSince(event, id, allowedGameIds)

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
    const current = await tx.participant.findUniqueOrThrow({ where: { id }, select: { name: true, phone: true, userId: true, email: true } })
    // Une adresse changée vers celle d'une autre fiche est refusée : réunir deux fiches n'est pas prévu (US-185). Un
    // doublon plus ancien reste modifiable tant que son adresse ne change pas
    const address = email?.trim()
    if (address && !sameAddress(current.email, address)) {
      await lockAddress(tx, address)
      const other = await ficheForAddress(tx, address, [...new Set([...uniqueGameIds, ...existingLinks.map((link) => link.gameId)])], id)
      if (other) throw duplicateAddressError(other, allowedGameIds)
    }
    await removal.apply(tx)
    // Une fiche sans aucun jeu est supprimée (US-036) : l'interface l'a fait confirmer
    if (!gameIdsToAdd.length && !await tx.participantGame.count({ where: { participantId: id } })) return null

    // Fiche qui reste rattachée : nom et téléphone sont tenus par la personne, l'envoi de l'équipe est ignoré (US-075)
    const userId = await accountIdForEmail(email)
    const heldByPerson = Boolean(userId && userId === current.userId)
    const effectiveName = heldByPerson ? current.name : name
    const effectivePhone = heldByPerson ? current.phone : phone || null
    // Nom et téléphone par jeu (ADR-0086) : ceux des jeux que voit la personne qui modifie
    const visibleKeptGameIds = managedExistingGameIds.filter((gameId) => nextGameIds.has(gameId))
    const updated = await tx.participant.update({
      where: { id },
      data: {
        name: effectiveName,
        slug: await generateUniqueSlug('participant', effectiveName, id),
        email: email || null,
        phone: effectivePhone,
        // Le rattachement suit l'adresse : autre compte, ou aucun (US-070)
        userId,
        gameLinks: {
          create: gameIdsToAdd.map((gameId) => ({ gameId, notes: gameNotes[gameId] || null, name: effectiveName, phone: effectivePhone })),
          updateMany: [
            { where: { gameId: { in: visibleKeptGameIds } }, data: { name: effectiveName, phone: effectivePhone } },
            // Note de chaque jeu déjà lié et reçu ; les notes des autres jeux ne bougent pas (US-069)
            ...Object.entries(gameNotes)
              .filter(([gameId]) => existingGameIds.has(gameId) && nextGameIds.has(gameId))
              .map(([gameId, text]) => ({ where: { gameId }, data: { notes: text || null } }))
          ]
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
