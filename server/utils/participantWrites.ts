import type { H3Event } from 'h3'
import type { z } from 'zod'
import { prisma, type PrismaTx } from '~/server/utils/prisma'
import { accessibleGameIds, requireCurrentUser, requireParticipantAccess } from '~/server/utils/gameAccess'
import type { participantCreateSchema, participantSchema } from '~/server/utils/schemas'
import { exposeParticipantGames, participantGameLinksInclude, planParticipantRemoval } from '~/server/utils/participants'
import { eraseParticipant } from '~/server/utils/participantPrivacy'
import { assertParticipantUnmodifiedSince } from '~/server/utils/concurrency'
import { accountIdForEmail, syncProfileToParticipants } from '~/server/utils/participantAccounts'
import { participantSlug } from '~/utils/participantSlug'

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
 * Fiche qui porte déjà cette adresse, dans tout Limbus (SPEC-022 R4, ADR-0086), même suivie par d'autres équipes : la
 * plus ancienne tant que des doublons existent (avant la fusion, US-240).
 */
async function ficheForAddress(client: PrismaTx, address: string, exceptId?: string) {
  return await client.participant.findFirst({
    where: { email: address, ...(exceptId ? { id: { not: exceptId } } : {}) },
    orderBy: { createdAt: 'asc' },
    select: { id: true, slug: true, name: true, userId: true, gameLinks: { select: { gameId: true, notes: true, name: true, phone: true, updatedAt: true } } }
  })
}

/**
 * Création d'une fiche. Une adresse qui a déjà une fiche, dans n'importe quelle équipe, n'en crée pas une deuxième
 * (SPEC-022 R4) : les jeux demandés, avec leurs notes, s'ajoutent à la fiche existante. Chaque équipe n'en voit que
 * ses jeux et ses propres nom et téléphone (R5, R6) : une fiche déjà dans les jeux de l'équipe garde les siens, et le
 * dit (`joinedExisting`, US-185) ; sinon, l'équipe garde ce qu'elle a saisi, et rien ne dit qu'une autre la suit.
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
      const existing = await ficheForAddress(tx, address)
      if (existing) {
        const notesByGame = new Map(existing.gameLinks.map((link) => [link.gameId, link.notes]))
        // Jeux de la fiche que voit l'équipe : leur nom et leur téléphone valent pour ses nouveaux jeux (US-185)
        const visible = existing.gameLinks.filter((link) => allowedGameIds === null || allowedGameIds.includes(link.gameId))
        const [latest] = [...visible].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
        const values = latest ? { name: latest.name ?? name, phone: latest.phone } : { name, phone: phone || null }
        await tx.participantGame.createMany({
          data: uniqueGameIds.filter((gameId) => !notesByGame.has(gameId)).map((gameId) => ({ participantId: existing.id, gameId, notes: gameNotes[gameId] || null, ...values }))
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
        // Rattachée à un compte : ses nouveaux jeux reçoivent les coordonnées que la personne a remplies
        return { id: existing.id, userId: existing.userId, joinedExisting: visible.length > 0 }
      }
    }
    // Rattachée au compte de son adresse (US-070) ; slug et compte ne se calculent que pour une vraie création
    const accountId = await accountIdForEmail(email)
    const created = await tx.participant.create({
      data: {
        name,
        // Adresse neutre, sans le nom (US-239)
        slug: participantSlug(),
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

/**
 * Déplace vers une autre fiche ce qu'une équipe tient d'une fiche, dans les jeux donnés (SPEC-022 R7, R8, ADR-0086) :
 * jeux et notes, nom et téléphone, inscriptions, équipe, casting, présence, paiements, envois, trombinoscopes, déroulé.
 * La fonction SQL est commune à la correction d'adresse et à la fusion des fiches (US-240).
 */
export async function moveParticipant(tx: PrismaTx, fromId: string, toId: string, gameIds: string[]) {
  if (!gameIds.length || fromId === toId) return
  await tx.$executeRaw`SELECT limbus_move_participant(${fromId}, ${toId}, ${gameIds}::text[])`
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
    // Adresse corrigée (SPEC-022 R7) : changée sur place si l'équipe voit tous les jeux de la fiche et qu'aucune autre
    // fiche ne la porte ; sinon, seuls les jeux de l'équipe passent à la fiche de cette adresse, créée au besoin. La
    // fiche d'origine garde son adresse pour les autres équipes, et aucun compte ne change d'adresse
    const address = email?.trim()
    let target: { id: string, userId: string | null } | null = null
    if (address && !sameAddress(current.email, address)) {
      await lockAddress(tx, address)
      const other = await ficheForAddress(tx, address, id)
      if (other || managedExistingGameIds.length < existingLinks.length) {
        target = other ?? await tx.participant.create({
          data: { name, slug: participantSlug(), email: address, userId: await accountIdForEmail(address) },
          select: { id: true, userId: true }
        })
      }
    }
    await removal.apply(tx)
    // Une fiche sans aucun jeu est supprimée (US-036) : l'interface l'a fait confirmer
    if (!gameIdsToAdd.length && !await tx.participantGame.count({ where: { participantId: id } })) return null

    // Fiche qui reste rattachée : nom et téléphone sont tenus par la personne, l'envoi de l'équipe est ignoré (US-075).
    // Une fiche dont l'équipe part vers une autre adresse garde son adresse et son compte
    const userId = target ? current.userId : await accountIdForEmail(email)
    const heldByPerson = !target && Boolean(userId && userId === current.userId)
    const effectiveName = heldByPerson ? current.name : name
    const effectivePhone = heldByPerson ? current.phone : phone || null
    // Nom et téléphone par jeu (ADR-0086) : ceux des jeux que voit la personne qui modifie
    const visibleKeptGameIds = managedExistingGameIds.filter((gameId) => nextGameIds.has(gameId))
    const updated = await tx.participant.update({
      where: { id },
      data: {
        // La fiche d'une équipe qui part vers une autre adresse reste celle des autres : ses colonnes ne changent pas
        name: target ? current.name : effectiveName,
        // L'adresse de page ne suit plus le nom : un nom donné par une équipe n'apparaît pas dans celle d'une autre (US-239)
        email: target ? current.email : email || null,
        phone: target ? current.phone : effectivePhone,
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
    const teamGameIds = [...visibleKeptGameIds, ...gameIdsToAdd]
    if (target) await moveParticipant(tx, id, target.id, teamGameIds)
    // Adresse corrigée : les inscriptions des jeux de l'équipe qui portaient l'ancienne la suivent, car c'est à
    // l'adresse de l'inscription que partent les emails du vivier (revue de la PR #233). Après le déplacement, qui
    // garde l'inscription la plus récemment modifiée
    if (address && current.email && !sameAddress(current.email, address)) {
      await tx.registration.updateMany({ where: { participantId: target?.id ?? id, gameId: { in: teamGameIds }, email: current.email }, data: { email: address } })
    }
    if (target) {
      // Partie de tous ses jeux : la fiche d'origine n'a plus de raison d'être
      if (!await tx.participantGame.count({ where: { participantId: id } })) await tx.participant.delete({ where: { id } })
      const moved = await tx.participant.findUniqueOrThrow({ where: { id: target.id }, include: participantGameLinksInclude(allowedGameIds) })
      return { updated: moved, newlyLinkedUserId: target.userId }
    }
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
    return exposeParticipantGames(await prisma.participant.findUniqueOrThrow({ where: { id: participant.id }, include: participantGameLinksInclude(allowedGameIds) }))
  }
  return exposeParticipantGames(participant)
}
