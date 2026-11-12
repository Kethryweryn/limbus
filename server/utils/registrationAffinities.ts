import { prisma, type PrismaTx } from '~/server/utils/prisma'
import { REGISTRATION_SEAT_STATUSES } from '~/utils/domain'
import { ALERT_AFFINITY_KINDS, PERSON_AFFINITY_KINDS, affinityLineKey, isPersonAffinityKind, suggestPeople } from '~/utils/affinityMatching'
import type { AffinityAnswers } from '~/server/utils/registrationForms'
import { byName, withGameValues, withGameValuesIn } from '~/server/utils/participantValues'

/**
 * Remplace les affinités d'une inscription par ses nouvelles réponses (ADR-0045). Une ligne de même sorte et de même
 * texte reprend le rattachement de l'ancienne (US-095, ADR-0049).
 */
export async function replaceAffinities(tx: PrismaTx, registrationId: string, affinities: AffinityAnswers | undefined) {
  const previous = await tx.registrationAffinity.findMany({
    where: { registrationId, OR: [{ targetParticipantId: { not: null } }, { targetUnknown: true }] },
    select: { kind: true, text: true, targetParticipantId: true, targetUnknown: true }
  })
  const links = new Map(previous.map((row) => [affinityLineKey(row.kind, row.text), row]))
  await tx.registrationAffinity.deleteMany({ where: { registrationId } })
  // Clés des affinités du formulaire : chacune est une valeur de l'énumération AffinityKind, ce que le typage vérifie
  const entries = Object.entries(affinities ?? {}) as Array<[keyof AffinityAnswers, string[] | undefined]>
  const rows = entries.flatMap(([kind, lines]) => (lines ?? []).map((text, position) => {
    const link = links.get(affinityLineKey(kind, text))
    return {
      registrationId,
      kind,
      text,
      position,
      targetParticipantId: link?.targetParticipantId ?? null,
      targetUnknown: link?.targetUnknown ?? false
    }
  }))
  if (rows.length) await tx.registrationAffinity.createMany({ data: rows })
}

/**
 * Affinités d'une inscription pour l'équipe (US-095) : chaque ligne avec sa personne rattachée, et, pour une ligne
 * qui désigne une personne et n'est pas encore rattachée, des personnes du jeu au nom proche. `people` sert au choix
 * libre parmi les fiches du jeu, sans la personne elle-même.
 */
export async function affinitiesForTeam(registration: { id: string, participantId: string }, gameId: string) {
  const [loadedRows, loadedPeople] = await Promise.all([
    prisma.registrationAffinity.findMany({
      where: { registrationId: registration.id },
      orderBy: { position: 'asc' },
      select: { id: true, kind: true, text: true, targetUnknown: true, targetParticipant: { select: { id: true } } }
    }),
    prisma.participant.findMany({
      where: { gameLinks: { some: { gameId } }, id: { not: registration.participantId } },
      select: { id: true }
    })
  ])
  // Noms tenus par l'équipe du jeu, triés à l'affichage (ADR-0086)
  const [rows, people] = await Promise.all([withGameValues(loadedRows, gameId), withGameValuesIn(loadedPeople, gameId)])
  people.sort(byName)
  const lines = rows.map(({ targetParticipant, ...row }) => {
    const linkable = isPersonAffinityKind(row.kind)
    return {
      ...row,
      linkable,
      target: targetParticipant,
      suggestions: linkable && !targetParticipant && !row.targetUnknown ? suggestPeople(row.text, people) : []
    }
  })
  return { lines, people }
}

/**
 * Rattache une ligne d'affinité (US-095) : à une fiche du jeu de la période, autre que la personne elle-même,
 * ou « inconnue » ; sans l'un ni l'autre, la ligne est détachée.
 */
export const linkableAffinitySelect = {
  id: true,
  kind: true,
  registration: { select: { participantId: true, period: { select: { gameId: true } } } }
} as const

type LinkableAffinity = { id: string, kind: string, registration: { participantId: string, period: { gameId: string } } }

export async function linkAffinity(affinity: LinkableAffinity, link: { targetParticipantId?: string | null, unknown?: boolean }) {
  if (!isPersonAffinityKind(affinity.kind)) {
    throw createError({ statusCode: 400, message: 'Cette affinité décrit une relation, pas une personne : elle ne se rattache pas.' })
  }
  const targetParticipantId = link.unknown ? null : link.targetParticipantId ?? null
  if (targetParticipantId) {
    if (targetParticipantId === affinity.registration.participantId) {
      throw createError({ statusCode: 400, message: 'Une personne ne peut pas être rattachée à sa propre affinité.' })
    }
    const inGame = await prisma.participantGame.findFirst({
      where: { participantId: targetParticipantId, gameId: affinity.registration.period.gameId },
      select: { id: true }
    })
    if (!inGame) throw createError({ statusCode: 400, message: 'Cette personne n’appartient pas au jeu.' })
  }
  // La personne peut avoir modifié ses réponses entre-temps : ses lignes ont alors été remplacées
  const { count } = await prisma.registrationAffinity.updateMany({
    where: { id: affinity.id },
    data: { targetParticipantId, targetUnknown: Boolean(link.unknown) }
  })
  if (!count) throw createError({ statusCode: 409, message: 'Les réponses de cette personne ont changé entre-temps : rechargez l’inscription.' })
  return await withGameValues(await prisma.registrationAffinity.findUniqueOrThrow({
    where: { id: affinity.id },
    select: { id: true, targetUnknown: true, targetParticipant: { select: { id: true } } }
  }), affinity.registration.period.gameId)
}

/**
 * Alertes et repères d'affinités des sessions de la sélection (US-096, ADR-0049), calculés à chaque lecture :
 * - une alerte par ligne « ne pas croiser » ou « ne pas jouer avec » d'une personne retenue ou inscrite dans une session,
 *   dont la personne rattachée est présente dans la même session (retenue, inscrite, ou dans le cast) (R25) ;
 * - pour chaque inscription de la période, ses personnes souhaitées rattachées et les sessions où elles sont présentes.
 */
export async function affinityOverview(periodId: string, sessionIds: string[]) {
  const { gameId } = await prisma.registrationPeriod.findUniqueOrThrow({ where: { id: periodId }, select: { gameId: true } })
  const loaded = await Promise.all([
    prisma.registrationSession.findMany({
      where: { sessionId: { in: sessionIds }, status: { in: REGISTRATION_SEAT_STATUSES } },
      select: {
        sessionId: true,
        registration: {
          select: {
            id: true,
            participant: { select: { id: true } },
            affinities: {
              where: { kind: { in: [...ALERT_AFFINITY_KINDS] }, targetParticipantId: { not: null } },
              select: { kind: true, text: true, targetParticipantId: true }
            }
          }
        }
      }
    }),
    prisma.sessionParticipant.findMany({
      where: { sessionId: { in: sessionIds } },
      select: { sessionId: true, participant: { select: { id: true } } }
    }),
    prisma.registration.findMany({
      where: { periodId },
      select: {
        id: true,
        affinities: {
          where: { kind: 'wantWith', targetParticipantId: { not: null } },
          orderBy: { position: 'asc' },
          select: { targetParticipant: { select: { id: true } } }
        },
        _count: { select: { affinities: { where: { kind: { in: [...PERSON_AFFINITY_KINDS] }, targetParticipantId: null, targetUnknown: false } } } }
      }
    })
  ])

  // Noms tenus par l'équipe du jeu (ADR-0086)
  const [placed, cast, periodRegistrations] = await withGameValues(loaded, gameId)
  // Personnes présentes par session, avec leur nom
  const present = new Map<string, Map<string, string>>(sessionIds.map((id) => [id, new Map()]))
  for (const row of placed) present.get(row.sessionId)?.set(row.registration.participant.id, row.registration.participant.name)
  for (const row of cast) present.get(row.sessionId)?.set(row.participant.id, row.participant.name)

  const alerts = placed.flatMap(({ sessionId, registration }) => registration.affinities
    .filter((affinity) => affinity.targetParticipantId !== registration.participant.id && present.get(sessionId)?.has(affinity.targetParticipantId!))
    .map((affinity) => ({
      sessionId,
      kind: affinity.kind,
      registrationId: registration.id,
      participantId: registration.participant.id,
      participantName: registration.participant.name,
      targetParticipantId: affinity.targetParticipantId!,
      targetName: present.get(sessionId)!.get(affinity.targetParticipantId!)!
    })))

  const sessionsOf = (participantId: string) => sessionIds.filter((id) => present.get(id)!.has(participantId))
  const wishes = Object.fromEntries(periodRegistrations
    .filter((registration) => registration.affinities.length)
    .map((registration) => [registration.id, registration.affinities.map(({ targetParticipant }) => ({
      participantId: targetParticipant!.id,
      name: targetParticipant!.name,
      sessionIds: sessionsOf(targetParticipant!.id)
    }))]))
  const toLink = Object.fromEntries(periodRegistrations
    .filter((registration) => registration._count.affinities)
    .map((registration) => [registration.id, registration._count.affinities]))

  return { alerts, wishes, toLink }
}
