import * as z from 'zod'
import { prisma } from '~/server/utils/prisma'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { findRegistrationPeriodOr404 } from '~/server/utils/registrationPeriods'
import { getCurrentRegistrationForm } from '~/server/utils/registrationForms'
import { currentQuestionLinks } from '~/server/utils/registrationQuestionLinks'
import { selectionOverview } from '~/server/utils/registrationSelection'
import { listDraws } from '~/server/utils/registrationDraws'
import { closedAnswers, processedAffinities } from '~/server/mcp/registrationProjection'
import { READ_ONLY, named, toolResult, type ToolContext } from '~/server/mcp/tools'

// Inscriptions (R7, R8) : vivier, formulaire, sélection et tirages. D'une personne : statut pour le jeu et pour chaque
// session, réponses fermées et affinités traitées ; ni coordonnées, ni allergies, ni texte libre de la personne
export function registerRegistrationTools({ event, server }: ToolContext) {
  server.registerTool('lister_periodes_inscription', {
    title: 'Lire le vivier d’un jeu',
    description: 'Le vivier d’un jeu (au plus un) : état, réglage des rejoueurs, sessions suivies avec leur ouverture et leur mode de sélection, nombre de personnes.',
    inputSchema: z.object({ jeuId: z.string() }),
    annotations: READ_ONLY
  }, ({ jeuId }) => toolResult(async () => {
    await requireGameAccess(event, jeuId)
    return await prisma.registrationPeriod.findMany({
      where: { gameId: jeuId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, state: true, replayPolicy: true, updatedAt: true,
        sessions: { select: { open: true, selectionMode: true, waitlistSize: true, session: named } },
        _count: { select: { registrations: true } }
      }
    })
  }))

  server.registerTool('lire_formulaire_inscription', {
    title: 'Lire le formulaire d’inscription',
    description: 'Formulaire d’inscription en vigueur d’un jeu : numéro de version, champs demandés, questions propres au jeu (libellé, sorte, options, et shuffleOptions à true si ses options s’affichent dans un ordre tiré au hasard), affinités demandées, question d’équilibre, et liens des réponses vers les personnages, factions et intrigues.',
    inputSchema: z.object({ jeuId: z.string() }),
    annotations: READ_ONLY
  }, ({ jeuId }) => toolResult(async () => {
    await requireGameAccess(event, jeuId)
    const [{ version, definition }, links] = await Promise.all([getCurrentRegistrationForm(jeuId), currentQuestionLinks(jeuId)])
    return { version, standardFields: definition.standardFields, questions: definition.questions, affinities: definition.affinities, balance: definition.balance, links }
  }))

  server.registerTool('lire_selection', {
    title: 'Lire la sélection du vivier',
    description: 'Sessions et places du vivier, puis chaque personne : statut pour le jeu et pour chaque session, rang en liste d’attente, réponses aux questions fermées et affinités rattachées par l’équipe.',
    inputSchema: z.object({ periodeId: z.string() }),
    annotations: READ_ONLY
  }, ({ periodeId }) => toolResult(async () => {
    const period = await findRegistrationPeriodOr404(periodeId)
    await requireGameAccess(event, period.gameId)
    const [overview, registrations] = await Promise.all([
      selectionOverview(period.id),
      prisma.registration.findMany({
        where: { periodId: period.id },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, status: true, source: true, balancePreference: true, questionAnswers: true, createdAt: true, respondedAt: true, updatedAt: true,
          participant: named,
          formVersion: { select: { definition: true } },
          sessionLines: { select: { sessionId: true, status: true, answer: true, waitlistPosition: true, announcedStatus: true, confirmedAt: true } },
          affinities: { orderBy: { position: 'asc' }, select: { kind: true, text: true, targetUnknown: true, targetParticipant: named } }
        }
      })
    ])
    return {
      sessions: overview.sessions.map((session) => ({ id: session.id, name: session.name, date: session.date, seats: session.seats, taken: session.taken, open: session.open, selectionMode: session.selectionMode })),
      replayerParticipantIds: overview.replayerParticipantIds,
      registrations: registrations.map(({ questionAnswers, formVersion, affinities, ...registration }) => ({
        ...registration,
        answers: closedAnswers(formVersion?.definition, questionAnswers),
        affinities: processedAffinities(affinities)
      }))
    }
  }))

  server.registerTool('lire_tirages', {
    title: 'Journal des tirages',
    description: 'Tirages au sort du vivier, session par session : réglages, résultat, auteur, annulation.',
    inputSchema: z.object({ periodeId: z.string() }),
    annotations: READ_ONLY
  }, ({ periodeId }) => toolResult(async () => {
    const period = await findRegistrationPeriodOr404(periodeId)
    await requireGameAccess(event, period.gameId)
    return await listDraws(period.id)
  }))
}
