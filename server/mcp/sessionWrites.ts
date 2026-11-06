import * as z from 'zod'
import type { H3Event } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { accessibleGameIds, requireCurrentUser, requireSessionAccess } from '~/server/utils/gameAccess'
import { participantCreateSchema, participantSchema, parseZod, sessionSchema, sessionTimelineSchema } from '~/server/utils/schemas'
import { createSession, updateSession, updateSessionTimeline } from '~/server/utils/sessionWrites'
import { createParticipant, updateParticipant } from '~/server/utils/participantWrites'
import { sessionCastingAssistant } from '~/server/utils/castingAssistant'
import { AI_LOG_ACTIONS } from '~/utils/aiAssistants'
import { SESSION_ROLES, SESSION_STATUSES } from '~/utils/domain'
import { WRITE, logWrite, requireWrite, text, toolResult, version, withVersion, type ToolContext } from '~/server/mcp/tools'

// Sessions, casting, déroulé et fiches participant écrits par un assistant (US-127 à US-129, SPEC-014 R10 à R13) : les
// fonctions de l'interface (sessionWrites, participantWrites), complétées avec la fiche actuelle, avec la version lue.
// Jamais : statut, visibilité publique, photo, réservation d'un personnage, coordonnées, retrait d'un jeu

const ROLES = [SESSION_ROLES.participant, SESSION_ROLES.organizer, SESSION_ROLES.npc, SESSION_ROLES.kitchen] as const
// Une date illisible effacerait la date de la session (parseDate) : elle est refusée ici
const date = (description: string) => z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), 'Date illisible : format ISO 8601 attendu').nullable().optional().describe(description)

/** Session actuelle sous la forme du corps de l'interface, photos, cadenas et réservations compris. */
async function currentSession(id: string) {
  const session = await prisma.session.findUniqueOrThrow({
    where: { id },
    select: {
      name: true, gameId: true, date: true, locationId: true, status: true, published: true,
      participants: { select: { participantId: true, role: true } },
      assignments: { select: { characterId: true, participantId: true, photoUrl: true, notes: true, locked: true, reservedRegistrationId: true } },
      timelineResponsibles: { select: { timelineEventId: true, participantId: true } }
    }
  })
  return { ...session, date: session.date?.toISOString() ?? null }
}

type SessionBody = Omit<Awaited<ReturnType<typeof currentSession>>, 'timelineResponsibles'>

/** Enregistre la session complétée, avec la version lue, et la note au journal. */
async function saveSession(event: H3Event, tool: string, sessionId: string, read: string, change: (current: SessionBody) => SessionBody) {
  requireWrite(event)
  const saved = await withVersion(event, read, () => updateSession(event, sessionId, async () => {
    const { timelineResponsibles: _timeline, ...current } = await currentSession(sessionId)
    return parseZod(sessionSchema, change(current))
  }))
  await logWrite(event, tool, AI_LOG_ACTIONS.changed, { type: 'session', id: saved.id, name: saved.name, gameId: saved.gameId })
  return { id: saved.id, version: saved.updatedAt }
}

function registerSessionWriteTools({ event, server }: ToolContext) {
  server.registerTool('creer_session', {
    title: 'Créer une session',
    description: 'Crée une session d’un jeu : nom, date et lieu du même jeu. Elle est prévue et n’est pas visible sur la page publique. L’équipe, le casting et le déroulé se règlent ensuite.',
    inputSchema: z.object({
      jeuId: z.string(),
      name: z.string().max(200),
      date: date('Date et heure, au format ISO 8601'),
      locationId: z.string().nullable().optional().describe('Lieu du jeu (lister_contenu, sorte lieux)')
    }),
    annotations: WRITE
  }, ({ jeuId, name, date: when, locationId }) => toolResult(async () => {
    requireWrite(event)
    const session = await createSession(event, async () => parseZod(sessionSchema, {
      name, gameId: jeuId, date: when ?? null, locationId: locationId ?? null,
      status: SESSION_STATUSES.scheduled, published: false, participants: [], assignments: []
    }))
    await logWrite(event, 'creer_session', AI_LOG_ACTIONS.created, { type: 'session', id: session.id, name: session.name, gameId: session.gameId })
    return { id: session.id, version: session.updatedAt }
  }))

  server.registerTool('modifier_session', {
    title: 'Modifier une session',
    description: 'Change le nom, la date ou le lieu d’une session. Les champs omis restent tels quels ; le statut, la visibilité, l’équipe et le casting ne changent pas.',
    inputSchema: z.object({
      sessionId: z.string(),
      version,
      name: z.string().max(200).optional(),
      date: date('Date et heure, au format ISO 8601 ; null la retire'),
      locationId: z.string().nullable().optional().describe('Lieu du jeu ; null le retire')
    }),
    annotations: WRITE
  }, ({ sessionId, version: read, name, date: when, locationId }) => toolResult(() => saveSession(event, 'modifier_session', sessionId, read, (current) => ({
    ...current,
    ...(name !== undefined && { name }),
    ...(when !== undefined && { date: when }),
    ...(locationId !== undefined && { locationId })
  }))))

  server.registerTool('modifier_equipe', {
    title: 'Modifier l’équipe d’une session',
    description: 'Donne l’équipe complète d’une session : chaque personne du jeu avec son rôle (participant, organizer, npc, kitchen). Un nouveau joueur (participant) doit être inscrit à cette session par le vivier : sinon c’est refusé, et decider_inscription le retient s’il est dans le vivier. Une personne retirée perd son personnage dans la session ; son suivi de paiement ne change pas.',
    inputSchema: z.object({
      sessionId: z.string(),
      version,
      team: z.array(z.object({ participantId: z.string(), role: z.enum(ROLES) })).max(1000).describe('Équipe complète')
    }),
    annotations: WRITE
  }, ({ sessionId, version: read, team }) => toolResult(() => saveSession(event, 'modifier_equipe', sessionId, read, (current) => {
    const kept = new Set(team.map((member) => member.participantId))
    return {
      ...current,
      participants: team,
      // Hors de l'équipe : plus de personnage, ni la photo et le cadenas de cette attribution
      assignments: current.assignments.map((line) => line.participantId && !kept.has(line.participantId)
        ? { ...line, participantId: null, photoUrl: null, locked: false }
        : line)
    }
  })))

  server.registerTool('modifier_casting', {
    title: 'Modifier le casting d’une session',
    description: 'Enregistre des lignes du casting : pour un personnage du jeu, la personne (ou null), la note de la ligne et le cadenas. Les lignes non données restent telles quelles. La photo d’une ligne est retirée quand sa personne change. Un personnage réservé pour une inscription retenue ne change pas de personne ici. Une personne qui n’est pas encore dans l’équipe doit être inscrite à cette session par le vivier : sinon c’est refusé, et decider_inscription la retient si elle est dans le vivier.',
    inputSchema: z.object({
      sessionId: z.string(),
      version,
      lines: z.array(z.object({
        characterId: z.string(),
        participantId: z.string().nullable().optional().describe('Personne du jeu ; null retire la personne'),
        notes: text('Note de la ligne (brief)'),
        locked: z.boolean().optional().describe('Cadenas : l’assistant de casting garde la ligne telle quelle')
      })).min(1).max(500)
    }),
    annotations: WRITE
  }, ({ sessionId, version: read, lines }) => toolResult(() => saveSession(event, 'modifier_casting', sessionId, read, (current) => {
    const assignments = new Map(current.assignments.map((line) => [line.characterId, line]))
    for (const given of lines) {
      const line = assignments.get(given.characterId) ?? { characterId: given.characterId, participantId: null, photoUrl: null, notes: null, locked: false, reservedRegistrationId: null }
      const participantId = given.participantId === undefined ? line.participantId : given.participantId
      const changed = participantId !== line.participantId
      if (changed && line.reservedRegistrationId) {
        throw createError({ statusCode: 400, message: 'Ce personnage est réservé pour une inscription retenue : sa personne se change dans l’interface' })
      }
      assignments.set(given.characterId, {
        ...line,
        participantId,
        // La photo était celle de la personne remplacée
        photoUrl: changed ? null : line.photoUrl,
        notes: given.notes === undefined ? line.notes : given.notes,
        locked: given.locked ?? line.locked
      })
    }
    return { ...current, assignments: [...assignments.values()] }
  })))

  server.registerTool('modifier_deroule', {
    title: 'Modifier le déroulé d’une session',
    description: 'Donne les responsables d’événements de la chronologie pour la session : des personnes de l’équipe en orga ou PNJ. Les événements non donnés gardent leurs responsables.',
    inputSchema: z.object({
      sessionId: z.string(),
      version,
      events: z.array(z.object({
        timelineEventId: z.string(),
        participantIds: z.array(z.string()).max(100).describe('Responsables (liste complète pour cet événement)')
      })).min(1).max(500)
    }),
    annotations: WRITE
  }, ({ sessionId, version: read, events }) => toolResult(async () => {
    requireWrite(event)
    // Accès d'abord : la fonction commune lit le corps avant (ordre de la route), et le corps lit la session
    await requireSessionAccess(event, sessionId)
    const current = await currentSession(sessionId)
    const result = await withVersion(event, read, () => updateSessionTimeline(event, sessionId, async () => {
      const responsibles = new Map<string, string[]>()
      for (const row of current.timelineResponsibles) {
        responsibles.set(row.timelineEventId, [...responsibles.get(row.timelineEventId) ?? [], row.participantId])
      }
      for (const given of events) responsibles.set(given.timelineEventId, given.participantIds)
      return parseZod(sessionTimelineSchema, { assignments: [...responsibles].map(([timelineEventId, participantIds]) => ({ timelineEventId, participantIds })) })
    }))
    await logWrite(event, 'modifier_deroule', AI_LOG_ACTIONS.changed, { type: 'session', id: sessionId, name: current.name, gameId: current.gameId })
    return { id: sessionId, version: result.updatedAt }
  }))

  server.registerTool('proposer_casting', {
    title: 'Proposer un casting',
    description: 'Lance l’assistant de casting sur le cast actuel de la session, ses personnes retenues et ses pré-inscrites : notes de chaque paire personne-personnage, interdits, alertes et proposition de répartition. Rien n’est écrit ; modifier_casting enregistre ensuite les lignes des personnes déjà dans l’équipe, et decider_inscription retient une pré-inscrite.',
    inputSchema: z.object({ sessionId: z.string() }),
    // Ne change rien, mais réservé aux autorisations en écriture (R10)
    annotations: { ...WRITE, readOnlyHint: true, idempotentHint: true }
  }, ({ sessionId }) => toolResult(async () => {
    requireWrite(event)
    const session = await requireSessionAccess(event, sessionId)
    const { assignments } = await currentSession(sessionId)
    const result = await sessionCastingAssistant(session, assignments.map(({ characterId, participantId, reservedRegistrationId, locked }) => ({ characterId, participantId, reservedRegistrationId, locked })), (await requireCurrentUser(event)).id)
    // Projection explicite : jamais le texte tapé des relations refusées (R8)
    return {
      players: result.players.map(({ id, name, reservedRegistrationId, hasAnswers }) => ({ id, name, reservedRegistrationId, hasAnswers })),
      characters: result.characters,
      pairs: result.pairs,
      proposal: result.proposal,
      unplaced: result.unplaced,
      lockedConflicts: result.lockedConflicts,
      avoidWarnings: result.avoidWarnings
    }
  }))
}

/** Fiche actuelle sous la forme du corps de l'interface : coordonnées gardées, jeux de l'autorisation et leurs notes. */
async function currentParticipant(event: H3Event, id: string) {
  const allowed = await accessibleGameIds(event)
  const participant = await prisma.participant.findUniqueOrThrow({
    where: { id },
    select: { name: true, email: true, phone: true, gameLinks: { where: allowed ? { gameId: { in: allowed } } : {}, select: { gameId: true, notes: true } } }
  })
  // Les jeux hors de l'autorisation ne sont ni envoyés ni retirés par la modification (managedExistingGameIds)
  return { name: participant.name, email: participant.email, phone: participant.phone, links: participant.gameLinks }
}

function registerParticipantWriteTools({ event, server }: ToolContext) {
  server.registerTool('creer_participant', {
    title: 'Créer une fiche participant',
    description: 'Crée une fiche participant dans un jeu : nom et note d’organisation de ce jeu. Elle n’a ni email ni téléphone.',
    inputSchema: z.object({
      jeuId: z.string(),
      name: z.string().max(200),
      notes: text('Note d’organisation pour ce jeu')
    }),
    annotations: WRITE
  }, ({ jeuId, name, notes }) => toolResult(async () => {
    requireWrite(event)
    const participant = await createParticipant(event, async () => parseZod(participantCreateSchema, { name, gameIds: [jeuId], gameNotes: { [jeuId]: notes ?? null } }))
    await logWrite(event, 'creer_participant', AI_LOG_ACTIONS.created, { type: 'participant', id: participant.id, name: participant.name, gameId: jeuId })
    return { id: participant.id, version: participant.updatedAt }
  }))

  server.registerTool('modifier_participant', {
    title: 'Modifier une fiche participant',
    description: 'Change le nom d’une fiche, sa note d’organisation pour des jeux autorisés, ou l’ajoute à d’autres jeux autorisés. Elle n’est jamais retirée d’un jeu ; ses coordonnées et les notes des autres jeux ne changent pas. Le nom d’une fiche rattachée à un compte reste celui du compte.',
    inputSchema: z.object({
      participantId: z.string(),
      version,
      name: z.string().max(200).optional(),
      notes: z.array(z.object({ jeuId: z.string(), notes: z.string().max(20_000).nullable() })).max(100).optional().describe('Note d’organisation, pour des jeux où la personne est ou est ajoutée'),
      addToGames: z.array(z.string()).max(100).optional().describe('Jeux où ajouter la personne')
    }),
    annotations: WRITE
  }, ({ participantId, version: read, name, notes, addToGames }) => toolResult(async () => {
    requireWrite(event)
    const participant = await withVersion(event, read, () => updateParticipant(event, participantId, async () => {
      const current = await currentParticipant(event, participantId)
      const gameNotes = Object.fromEntries(current.links.map((link) => [link.gameId, link.notes]))
      for (const given of notes ?? []) gameNotes[given.jeuId] = given.notes
      return parseZod(participantSchema, {
        name: name ?? current.name,
        email: current.email,
        phone: current.phone,
        gameIds: [...new Set([...current.links.map((link) => link.gameId), ...addToGames ?? []])],
        gameNotes
      })
    }))
    // Sans jeu restant, la modification efface la fiche : impossible ici, chaque jeu de l'autorisation est renvoyé
    if (!('id' in participant)) throw createError({ statusCode: 500, message: 'Fiche effacée' })
    await logWrite(event, 'modifier_participant', AI_LOG_ACTIONS.changed, { type: 'participant', id: participant.id, name: participant.name, gameId: participant.games.map((game) => game.id) })
    return { id: participant.id, version: participant.updatedAt }
  }))
}

export function registerSessionAndParticipantWriteTools(context: ToolContext) {
  if (!context.event.context.aiAuthorization?.canWrite) return
  registerSessionWriteTools(context)
  registerParticipantWriteTools(context)
}
