import * as z from 'zod'
import { prisma } from '~/server/utils/prisma'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { findRegistrationPeriodOr404 } from '~/server/utils/registrationPeriods'
import { getCurrentRegistrationForm } from '~/server/utils/registrationForms'
import { selectionOverview } from '~/server/utils/registrationSelection'
import { listDraws } from '~/server/utils/registrationDraws'
import { closedAnswers, processedAffinities } from '~/server/mcp/registrationProjection'
import { READ_ONLY, named, toolResult, type ToolContext } from '~/server/mcp/tools'

// Inscriptions (R7, R8) : périodes, formulaire, sélection et tirages. D'une inscription : statut, session, disponibilités,
// réponses fermées et affinités traitées ; ni coordonnées, ni allergies, ni texte libre de la personne
export function registerRegistrationTools({ event, server }: ToolContext) {
  server.registerTool('lister_periodes_inscription', {
    title: 'Lister les périodes d’inscription',
    description: 'Périodes d’inscription d’un jeu : mode d’entrée et de sélection, état, sessions et places, nombre d’inscriptions.',
    inputSchema: z.object({ jeuId: z.string() }),
    annotations: READ_ONLY
  }, ({ jeuId }) => toolResult(async () => {
    await requireGameAccess(event, jeuId)
    return await prisma.registrationPeriod.findMany({
      where: { gameId: jeuId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, name: true, scope: true, entryMode: true, selectionMode: true, state: true, closesAt: true,
        replayPolicy: true, waitlistSize: true, updatedAt: true,
        sessions: { select: { seats: true, session: named } },
        _count: { select: { registrations: true } }
      }
    })
  }))

  server.registerTool('lire_formulaire_inscription', {
    title: 'Lire le formulaire d’inscription',
    description: 'Formulaire d’inscription en vigueur d’un jeu : questions propres au jeu (libellé, sorte, options), affinités demandées, question d’équilibre.',
    inputSchema: z.object({ jeuId: z.string() }),
    annotations: READ_ONLY
  }, ({ jeuId }) => toolResult(async () => {
    await requireGameAccess(event, jeuId)
    const { version, definition } = await getCurrentRegistrationForm(jeuId)
    return { version, questions: definition.questions, affinities: definition.affinities, balance: definition.balance }
  }))

  server.registerTool('lire_selection', {
    title: 'Lire la sélection d’une période',
    description: 'Sessions et places d’une période, puis chaque inscription : personne, statut, session, disponibilités, liste d’attente, réponses aux questions fermées et affinités rattachées par l’équipe.',
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
          id: true, status: true, source: true, balancePreference: true, questionAnswers: true, createdAt: true, respondedAt: true,
          confirmedAt: true, announcedStatus: true, updatedAt: true,
          participant: named,
          session: named,
          formVersion: { select: { definition: true } },
          availabilities: { select: { sessionId: true } },
          waitlistEntries: { select: { sessionId: true, position: true } },
          affinities: { orderBy: { position: 'asc' }, select: { kind: true, text: true, targetUnknown: true, targetParticipant: named } }
        }
      })
    ])
    return {
      sessions: overview.sessions.map((session) => ({ id: session.id, name: session.name, date: session.date, seats: session.seats, taken: session.taken })),
      replayerParticipantIds: overview.replayerParticipantIds,
      registrations: registrations.map(({ questionAnswers, formVersion, affinities, availabilities, ...registration }) => ({
        ...registration,
        availableSessionIds: availabilities.map((availability) => availability.sessionId),
        answers: closedAnswers(formVersion?.definition, questionAnswers),
        affinities: processedAffinities(affinities)
      }))
    }
  }))

  server.registerTool('lire_tirages', {
    title: 'Journal des tirages',
    description: 'Tirages au sort d’une période : réglages, résultat, auteur, annulation.',
    inputSchema: z.object({ periodeId: z.string() }),
    annotations: READ_ONLY
  }, ({ periodeId }) => toolResult(async () => {
    const period = await findRegistrationPeriodOr404(periodeId)
    await requireGameAccess(event, period.gameId)
    return await listDraws(period.id)
  }))
}
