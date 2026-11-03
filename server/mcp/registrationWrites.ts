import * as z from 'zod'
import type { H3Event } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireCurrentUser, requireGameAccess } from '~/server/utils/gameAccess'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'
import { parseZod, registrationFormDefinitionSchema, registrationPeriodSchema, registrationPeriodUpdateSchema, registrationQuestionLinksSchema, registrationSelectionSchema } from '~/server/utils/schemas'
import { createRegistrationPeriod, updateRegistrationPeriod } from '~/server/utils/registrationPeriodWrites'
import { findRegistrationPeriodOr404 } from '~/server/utils/registrationPeriods'
import { findRegistrationOr404 } from '~/server/utils/registrations'
import { applySelection, reorderWaitlist, setPoolSeats } from '~/server/utils/registrationSelection'
import { cancelDraw, drawPeriod } from '~/server/utils/registrationDraws'
import { getCurrentRegistrationForm, saveRegistrationFormDefinition } from '~/server/utils/registrationForms'
import { currentQuestionLinks, saveQuestionLinks } from '~/server/utils/registrationQuestionLinks'
import { AI_LOG_ACTIONS } from '~/utils/aiAssistants'
import {
  REGISTRATION_ENTRY_MODES,
  REGISTRATION_PERIOD_SCOPES,
  REGISTRATION_PERIOD_STATES,
  REGISTRATION_REPLAY_POLICIES,
  REGISTRATION_SELECTION_ACTIONS,
  REGISTRATION_SELECTION_MODES,
  REGISTRATION_STATUSES
} from '~/utils/domain'
import { WRITE, logWrite, requireWrite, toolResult, version, withVersion, type ToolContext } from '~/server/mcp/tools'

// Inscriptions écrites par un assistant (US-130 à US-132, SPEC-014 R10 à R13) : les fonctions de l'interface, avec la
// version lue. Jamais : ouvrir, clore ou supprimer une période, inviter, annoncer, envoyer, ni décider pour une
// inscription dont une décision a déjà été annoncée

const periodFields = {
  name: z.string().max(200),
  closesAt: z.string().nullable().optional().describe('Date de clôture, au format ISO 8601 ; null la retire'),
  responseDelayDays: z.number().int().optional().describe('Jours laissés pour répondre à une invitation ou confirmer une place'),
  notifyTeam: z.boolean().optional().describe('L’équipe est prévenue de chaque nouvelle inscription'),
  replayPolicy: z.enum([REGISTRATION_REPLAY_POLICIES.allowed, REGISTRATION_REPLAY_POLICIES.flagged, REGISTRATION_REPLAY_POLICIES.excluded]).optional()
    .describe('Personnes qui ont déjà joué : allowed, flagged (signalées) ou excluded'),
  selectionMode: z.enum([REGISTRATION_SELECTION_MODES.chosen, REGISTRATION_SELECTION_MODES.random, REGISTRATION_SELECTION_MODES.mixed]).optional()
    .describe('chosen (à la main), random (tirage) ou mixed'),
  organizerPicks: z.number().int().nullable().optional().describe('Mode mixte : places retenues à la main par session'),
  weightNotDrawnBefore: z.boolean().optional().describe('Tirage : chances doublées pour qui n’a pas été tiré avant'),
  weightBalance: z.boolean().optional().describe('Tirage : tenir compte de l’équilibre du jeu'),
  waitlistSize: z.number().int().optional().describe('Taille de la liste d’attente de chaque session'),
  sessions: z.array(z.object({
    sessionId: z.string(),
    seats: z.number().int().nullable().optional().describe('Places ; absent, le nombre de personnages PJ du jeu')
  })).max(200).optional().describe('Sessions de la période (liste complète) ; aucune pour une inscription permanente')
}

/** Période d'un jeu de l'autorisation, et sa version lue contrôlée : listes d'attente, places et tirages en dépendent. */
async function requirePeriod(event: H3Event, periodId: string) {
  const period = await findRegistrationPeriodOr404(periodId)
  await requireGameAccess(event, period.gameId)
  await assertUnmodifiedSince(event, 'registrationPeriod', period.id)
  return await prisma.registrationPeriod.findUniqueOrThrow({ where: { id: period.id }, select: { id: true, name: true, gameId: true } })
}

function registerPeriodTools({ event, server }: ToolContext) {
  server.registerTool('creer_periode_inscription', {
    title: 'Créer une période d’inscription',
    description: 'Prépare une période d’inscription d’un jeu, en brouillon : l’équipe la relit et l’ouvre elle-même. Rien n’est envoyé ni diffusé.',
    inputSchema: z.object({
      jeuId: z.string(),
      scope: z.enum([REGISTRATION_PERIOD_SCOPES.sessions, REGISTRATION_PERIOD_SCOPES.game]).optional()
        .describe('sessions (période ordinaire) ou game (inscription permanente au jeu)'),
      entryMode: z.enum([REGISTRATION_ENTRY_MODES.invitation, REGISTRATION_ENTRY_MODES.form]).optional()
        .describe('invitation ou form (formulaire public) ; ne change plus ensuite'),
      ...periodFields
    }),
    annotations: WRITE
  }, ({ jeuId, ...fields }) => toolResult(async () => {
    requireWrite(event)
    const period = await createRegistrationPeriod(event, async () => parseZod(registrationPeriodSchema, {
      ...fields,
      gameId: jeuId,
      state: REGISTRATION_PERIOD_STATES.draft
    }))
    await logWrite(event, 'creer_periode_inscription', AI_LOG_ACTIONS.created, { type: 'registrationPeriod', id: period.id, name: period.name, gameId: period.gameId })
    return { id: period.id, version: period.updatedAt }
  }))

  server.registerTool('modifier_periode_inscription', {
    title: 'Modifier une période d’inscription',
    description: 'Change une période d’inscription, brouillon, ouverte ou close : les champs omis restent tels quels, et son état ne change jamais.',
    inputSchema: z.object({ periodeId: z.string(), version, ...periodFields, name: periodFields.name.optional() }),
    annotations: WRITE
  }, ({ periodeId, version: read, ...fields }) => toolResult(async () => {
    requireWrite(event)
    const period = await withVersion(event, read, () => updateRegistrationPeriod(event, periodeId, async () => {
      const current = await prisma.registrationPeriod.findUniqueOrThrow({
        where: { id: periodeId },
        select: { name: true, gameId: true, sessions: { select: { sessionId: true, seats: true } } }
      })
      // L'état n'est jamais envoyé : la modification garde l'état actuel
      return parseZod(registrationPeriodUpdateSchema, { name: current.name, gameId: current.gameId, sessions: current.sessions, ...fields })
    }))
    await logWrite(event, 'modifier_periode_inscription', AI_LOG_ACTIONS.changed, { type: 'registrationPeriod', id: period.id, name: period.name, gameId: period.gameId })
    return { id: period.id, version: period.updatedAt }
  }))
}

// Le formulaire est celui du jeu : le journal le nomme ainsi, le jeu figurant déjà sur la ligne
const FORM_NAME = 'formulaire d’inscription'

function registerFormTools({ event, server }: ToolContext) {
  const setting = z.object({ asked: z.boolean(), required: z.boolean() })

  server.registerTool('modifier_formulaire_inscription', {
    title: 'Modifier le formulaire d’inscription',
    description: 'Enregistre une nouvelle version du formulaire d’inscription d’un jeu. Seules les parties données changent : champs demandés, affinités, question d’équilibre, liste des questions (complète). Une question sans id est nouvelle ; changer la sorte d’une question en fait une autre.',
    inputSchema: z.object({
      jeuId: z.string(),
      version: z.number().int().nullable().describe('Numéro de version lu (lire_formulaire_inscription) ; null s’il n’y en a pas encore'),
      standardFields: z.record(z.string(), setting).optional().describe('Champs demandés, par clé (asked, required)'),
      affinities: z.record(z.string(), setting).optional().describe('Affinités demandées, par clé'),
      balance: setting.optional().describe('Question d’équilibre'),
      questions: z.array(z.object({
        id: z.string().optional(),
        label: z.string(),
        type: z.enum(['text', 'single', 'multiple', 'scale']),
        required: z.boolean().optional(),
        options: z.array(z.string()).optional()
      })).max(100).optional().describe('Questions propres au jeu (liste complète)')
    }),
    annotations: WRITE
  }, ({ jeuId, version: read, ...given }) => toolResult(async () => {
    requireWrite(event)
    await requireGameAccess(event, jeuId)
    const { definition } = await getCurrentRegistrationForm(jeuId)
    const { baseVersionNumber: _base, ...parsed } = parseZod(registrationFormDefinitionSchema, { ...definition, ...given })
    const saved = await saveRegistrationFormDefinition(jeuId, parsed, read)
    await logWrite(event, 'modifier_formulaire_inscription', AI_LOG_ACTIONS.changed, { type: 'registrationForm', id: jeuId, name: FORM_NAME, gameId: jeuId })
    return { version: saved.version?.number ?? null }
  }))

  server.registerTool('relier_questionnaire', {
    title: 'Relier le questionnaire au casting',
    description: 'Relie des réponses du formulaire à un personnage, une faction ou une intrigue du jeu, pour l’assistant de casting. Les liens des questions données sont remplacés ; ceux des autres questions restent.',
    inputSchema: z.object({
      jeuId: z.string(),
      version: z.number().int().describe('Numéro de version du formulaire lu'),
      questions: z.array(z.object({
        questionId: z.string(),
        links: z.array(z.object({
          option: z.string().optional().describe('Option choisie ; vide pour une échelle'),
          characterId: z.string().optional(),
          factionId: z.string().optional(),
          intrigueId: z.string().optional()
        })).max(200).describe('Liens de cette question (liste complète)')
      })).min(1).max(100)
    }),
    annotations: WRITE
  }, ({ jeuId, version: read, questions }) => toolResult(async () => {
    requireWrite(event)
    await requireGameAccess(event, jeuId)
    const { version: current } = await getCurrentRegistrationForm(jeuId)
    if ((current?.number ?? null) !== read) {
      throw createError({ statusCode: 409, message: 'Le formulaire a été modifié par quelqu’un d’autre depuis sa lecture : relisez-le.' })
    }
    const given = new Set(questions.map((question) => question.questionId))
    // Liens en vigueur des autres questions : ceux d'une question ou d'une option retirée depuis ne sont pas renvoyés
    const kept = (await currentQuestionLinks(jeuId))
      .filter((link) => !given.has(link.questionId))
      .map(({ questionId, option, target }) => ({ questionId, option, [`${target.kind}Id`]: target.id }))
    const { links } = parseZod(registrationQuestionLinksSchema, {
      links: [...kept, ...questions.flatMap((question) => question.links.map((link) => ({ questionId: question.questionId, ...link })))]
    })
    const saved = await saveQuestionLinks(jeuId, links)
    await logWrite(event, 'relier_questionnaire', AI_LOG_ACTIONS.changed, { type: 'registrationForm', id: jeuId, name: FORM_NAME, gameId: jeuId })
    return { links: saved.length }
  }))
}

function registerSelectionTools({ event, server }: ToolContext) {
  server.registerTool('decider_inscription', {
    title: 'Décider d’une inscription',
    description: 'Retient une inscription pour une session (retain), la met en liste d’attente (waitlist) ou l’en retire (unwaitlist), l’écarte (reject) ou la remet à trier (reset). Rien n’est annoncé ni envoyé : l’équipe annonce elle-même. Une inscription dont une décision a déjà été annoncée se change dans l’interface.',
    inputSchema: z.object({
      inscriptionId: z.string(),
      version,
      action: z.enum(REGISTRATION_SELECTION_ACTIONS),
      sessionId: z.string().nullable().optional().describe('Session, pour retain, waitlist et unwaitlist')
    }),
    annotations: WRITE
  }, ({ inscriptionId, version: read, action, sessionId }) => toolResult(async () => {
    requireWrite(event)
    const registration = await findRegistrationOr404(inscriptionId)
    await requireGameAccess(event, registration.period.gameId)
    const body = parseZod(registrationSelectionSchema, { action, sessionId })
    const result = await withVersion(event, read, async () => {
      await assertUnmodifiedSince(event, 'registration', registration.id)
      const { announcedStatus, participant } = await prisma.registration.findUniqueOrThrow({ where: { id: registration.id }, select: { announcedStatus: true, participant: { select: { name: true } } } })
      if (announcedStatus) {
        throw createError({ statusCode: 409, message: 'Une décision a déjà été annoncée à cette personne : changez-la dans l’interface.' })
      }
      await applySelection(registration.id, body.action, body.sessionId ?? null, await requireCurrentUser(event))
      return participant
    })
    const { updatedAt } = await prisma.registration.findUniqueOrThrow({ where: { id: registration.id }, select: { updatedAt: true } })
    await logWrite(event, 'decider_inscription', AI_LOG_ACTIONS.changed, { type: 'registration', id: registration.id, name: result.name, gameId: registration.period.gameId })
    return { id: registration.id, version: updatedAt }
  }))

  server.registerTool('ordonner_liste_attente', {
    title: 'Ordonner une liste d’attente',
    description: 'Fixe l’ordre de la liste d’attente d’une session de la période : les inscriptions en attente, de la première à la dernière.',
    inputSchema: z.object({ periodeId: z.string(), version, sessionId: z.string(), inscriptionIds: z.array(z.string()).max(1000) }),
    annotations: WRITE
  }, ({ periodeId, version: read, sessionId, inscriptionIds }) => toolResult(async () => {
    requireWrite(event)
    const period = await withVersion(event, read, () => requirePeriod(event, periodeId))
    const result = await reorderWaitlist(period.id, sessionId, inscriptionIds)
    await logWrite(event, 'ordonner_liste_attente', AI_LOG_ACTIONS.changed, { type: 'registrationPeriod', id: period.id, name: period.name, gameId: period.gameId })
    return result
  }))

  server.registerTool('regler_places_vivier', {
    title: 'Régler les places du vivier',
    description: 'Places d’une session recrutée par l’inscription permanente du jeu ; null : le nombre de personnages PJ.',
    inputSchema: z.object({ periodeId: z.string(), version, sessionId: z.string(), seats: z.number().int().min(0).max(1000).nullable() }),
    annotations: WRITE
  }, ({ periodeId, version: read, sessionId, seats }) => toolResult(async () => {
    requireWrite(event)
    const period = await withVersion(event, read, () => requirePeriod(event, periodeId))
    const result = await setPoolSeats(period.id, sessionId, seats)
    await logWrite(event, 'regler_places_vivier', AI_LOG_ACTIONS.changed, { type: 'registrationPeriod', id: period.id, name: period.name, gameId: period.gameId })
    return result
  }))

  server.registerTool('tirer_au_sort', {
    title: 'Tirer au sort',
    description: 'Tire au sort les inscriptions reçues d’une période en mode tirage ou mixte. Les décisions restent à annoncer par l’équipe ; rien n’est envoyé.',
    inputSchema: z.object({ periodeId: z.string(), version }),
    annotations: WRITE
  }, ({ periodeId, version: read }) => toolResult(async () => {
    requireWrite(event)
    const period = await withVersion(event, read, () => requirePeriod(event, periodeId))
    // Le tirage décide pour les inscriptions reçues : aucune ne doit avoir déjà reçu une annonce
    if (await prisma.registration.count({ where: { periodId: period.id, status: REGISTRATION_STATUSES.received, announcedStatus: { not: null } } })) {
      throw createError({ statusCode: 409, message: 'Une inscription à tirer a déjà reçu une annonce : lancez ce tirage depuis l’interface.' })
    }
    const draw = await drawPeriod(period.id, await requireCurrentUser(event))
    await logWrite(event, 'tirer_au_sort', AI_LOG_ACTIONS.created, { type: 'registrationDraw', id: draw.id, name: period.name, gameId: period.gameId })
    return draw
  }))

  server.registerTool('annuler_tirage', {
    title: 'Annuler un tirage',
    description: 'Annule un tirage tant que rien n’en est annoncé : ses décisions repartent à « reçue ».',
    inputSchema: z.object({ tirageId: z.string(), version: version.describe('Version lue de la période du tirage') }),
    annotations: { ...WRITE, destructiveHint: true }
  }, ({ tirageId, version: read }) => toolResult(async () => {
    requireWrite(event)
    const draw = await prisma.registrationDraw.findUnique({ where: { id: tirageId }, select: { id: true, periodId: true } })
    if (!draw) throw createError({ statusCode: 404, message: 'Tirage introuvable' })
    const period = await withVersion(event, read, () => requirePeriod(event, draw.periodId))
    const result = await cancelDraw(draw.id, await requireCurrentUser(event))
    await logWrite(event, 'annuler_tirage', AI_LOG_ACTIONS.changed, { type: 'registrationDraw', id: draw.id, name: period.name, gameId: period.gameId })
    return result
  }))
}

export function registerRegistrationWriteTools(context: ToolContext) {
  if (!context.event.context.aiAuthorization?.canWrite) return
  registerPeriodTools(context)
  registerFormTools(context)
  registerSelectionTools(context)
}
