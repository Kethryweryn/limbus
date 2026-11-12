import * as z from 'zod'
import type { H3Event } from 'h3'
import { prisma } from '~/server/utils/prisma'
import { requireCurrentUser, requireGameAccess } from '~/server/utils/gameAccess'
import { assertUnmodifiedSince } from '~/server/utils/concurrency'
import { parseZod, registrationFormDefinitionSchema, registrationPeriodSchema, registrationPeriodUpdateSchema, registrationQuestionLinksSchema, registrationSelectionSchema, registrationSessionSettingsSchema } from '~/server/utils/schemas'
import { createRegistrationPeriod, updateRegistrationPeriod, updateRegistrationSession } from '~/server/utils/registrationPeriodWrites'
import { findRegistrationPeriodOr404 } from '~/server/utils/registrationPeriods'
import { findRegistrationOr404 } from '~/server/utils/registrations'
import { applySelection, reorderWaitlist } from '~/server/utils/registrationSelection'
import { cancelDraw, drawSession } from '~/server/utils/registrationDraws'
import { getCurrentRegistrationForm, saveRegistrationFormDefinition } from '~/server/utils/registrationForms'
import { currentQuestionLinks, saveQuestionLinks } from '~/server/utils/registrationQuestionLinks'
import { AI_LOG_ACTIONS } from '~/utils/aiAssistants'
import {
  REGISTRATION_PERIOD_STATES,
  REGISTRATION_REPLAY_POLICIES,
  REGISTRATION_SELECTION_ACTIONS,
  REGISTRATION_SELECTION_MODES,
  REGISTRATION_SESSION_STATUSES
} from '~/utils/domain'
import { WRITE, logWrite, requireWrite, toolResult, version, withVersion, type ToolContext } from '~/server/mcp/tools'
import { withGameValues } from '~/server/utils/participantValues'

// Inscriptions écrites par un assistant (US-130 à US-132, SPEC-014 R10 à R13) : les fonctions de l'interface, avec la
// version lue. Jamais : ouvrir, fermer ou supprimer un vivier, ouvrir une session, inviter, annoncer, envoyer, ni décider
// pour une session dont une décision a déjà été annoncée

const periodFields = {
  responseDelayDays: z.number().int().optional().describe('Jours laissés pour répondre à une invitation ou confirmer une place'),
  notifyTeam: z.boolean().optional().describe('L’équipe est prévenue de chaque nouvelle réponse au questionnaire'),
  replayPolicy: z.enum([REGISTRATION_REPLAY_POLICIES.allowed, REGISTRATION_REPLAY_POLICIES.flagged, REGISTRATION_REPLAY_POLICIES.excluded]).optional()
    .describe('Personnes qui ont déjà joué : allowed, flagged (signalées) ou excluded')
}

/** Vivier d'un jeu de l'autorisation, et sa version lue contrôlée : listes d'attente et tirages en dépendent. */
async function requirePeriod(event: H3Event, periodId: string) {
  const period = await findRegistrationPeriodOr404(periodId)
  await requireGameAccess(event, period.gameId)
  await assertUnmodifiedSince(event, 'registrationPeriod', period.id)
  return await prisma.registrationPeriod.findUniqueOrThrow({ where: { id: period.id }, select: { id: true, gameId: true } })
}

function registerPeriodTools({ event, server }: ToolContext) {
  server.registerTool('creer_periode_inscription', {
    title: 'Créer le vivier d’un jeu',
    description: 'Prépare le vivier d’un jeu, qui n’en a qu’un, en brouillon : l’équipe le relit et l’ouvre elle-même. Rien n’est envoyé ni diffusé.',
    inputSchema: z.object({ jeuId: z.string(), ...periodFields }),
    annotations: WRITE
  }, ({ jeuId, ...fields }) => toolResult(async () => {
    requireWrite(event)
    const period = await createRegistrationPeriod(event, async () => parseZod(registrationPeriodSchema, {
      ...fields,
      gameId: jeuId,
      state: REGISTRATION_PERIOD_STATES.draft
    }))
    await logWrite(event, 'creer_periode_inscription', AI_LOG_ACTIONS.created, { type: 'registrationPeriod', id: period.id, name: POOL_NAME, gameId: period.gameId })
    return { id: period.id, version: period.updatedAt }
  }))

  server.registerTool('modifier_periode_inscription', {
    title: 'Modifier le vivier d’un jeu',
    description: 'Change les réglages du vivier : les champs omis restent tels quels, et son état ne change jamais.',
    inputSchema: z.object({ periodeId: z.string(), version, ...periodFields }),
    annotations: WRITE
  }, ({ periodeId, version: read, ...fields }) => toolResult(async () => {
    requireWrite(event)
    const period = await withVersion(event, read, () => updateRegistrationPeriod(event, periodeId, async () => {
      const current = await prisma.registrationPeriod.findUniqueOrThrow({ where: { id: periodeId }, select: { gameId: true } })
      // L'état n'est jamais envoyé : la modification garde l'état actuel
      return parseZod(registrationPeriodUpdateSchema, { gameId: current.gameId, ...fields })
    }))
    await logWrite(event, 'modifier_periode_inscription', AI_LOG_ACTIONS.changed, { type: 'registrationPeriod', id: period.id, name: POOL_NAME, gameId: period.gameId })
    return { id: period.id, version: period.updatedAt }
  }))

  server.registerTool('regler_selection_session', {
    title: 'Régler la sélection d’une session',
    description: 'Mode de sélection d’une session du vivier et réglages de son tirage : les champs omis restent tels quels. Ne l’ouvre ni ne la referme : c’est l’équipe qui le fait.',
    inputSchema: z.object({
      periodeId: z.string(),
      version,
      sessionId: z.string(),
      selectionMode: z.enum([REGISTRATION_SELECTION_MODES.chosen, REGISTRATION_SELECTION_MODES.random, REGISTRATION_SELECTION_MODES.mixed]).optional()
        .describe('chosen (à la main), random (tirage) ou mixed'),
      organizerPicks: z.number().int().nullable().optional().describe('Mode mixte : places retenues à la main par organisatrice'),
      weightNotDrawnBefore: z.boolean().optional().describe('Tirage : chances doublées pour qui est resté sans place lors d’un tirage d’une session plus ancienne'),
      weightBalance: z.boolean().optional().describe('Tirage : tenir compte de l’équilibre du jeu'),
      waitlistSize: z.number().int().optional().describe('Taille de la liste d’attente après le tirage')
    }),
    annotations: WRITE
  }, ({ periodeId, version: read, sessionId, ...fields }) => toolResult(async () => {
    requireWrite(event)
    const period = await withVersion(event, read, () => requirePeriod(event, periodeId))
    const result = await updateRegistrationSession(period, sessionId, parseZod(registrationSessionSettingsSchema, fields))
    await logWrite(event, 'regler_selection_session', AI_LOG_ACTIONS.changed, { type: 'registrationPeriod', id: period.id, name: POOL_NAME, gameId: period.gameId })
    return result
  }))
}

// Le formulaire est celui du jeu : le journal le nomme ainsi, le jeu figurant déjà sur la ligne
const FORM_NAME = 'formulaire d’inscription'
const POOL_NAME = 'Vivier'

function registerFormTools({ event, server }: ToolContext) {
  const setting = z.object({ asked: z.boolean(), required: z.boolean() })

  server.registerTool('modifier_formulaire_inscription', {
    title: 'Modifier le formulaire d’inscription',
    description: 'Enregistre une nouvelle version du formulaire d’inscription d’un jeu. Seules les parties données changent : champs demandés, affinités, question d’équilibre, liste des questions (complète). Une question sans id est nouvelle ; changer la sorte d’une question en fait une autre.',
    inputSchema: z.object({
      jeuId: z.string(),
      version: z.number().int().nullable().describe('Numéro de version lu (lire_formulaire_inscription) ; null s’il n’y en a pas encore'),
      standardFields: z.record(z.string(), setting).optional().describe('Champs demandés, par clé (asked, required). Le contact d’urgence (toujours obligatoire) et les allergies (toujours demandées) ne se règlent pas'),
      affinities: z.record(z.string(), setting).optional().describe('Affinités demandées, par clé'),
      balance: setting.optional().describe('Question d’équilibre'),
      questions: z.array(z.object({
        id: z.string().optional(),
        label: z.string(),
        type: z.enum(['text', 'single', 'multiple', 'scale']),
        required: z.boolean().optional(),
        options: z.array(z.string()).optional(),
        shuffleOptions: z.boolean().optional().describe('Question à choix : options dans un ordre tiré au hasard à chaque affichage. Absent, une question existante garde son réglage')
      })).max(100).optional().describe('Questions propres au jeu (liste complète)')
    }),
    annotations: WRITE
  }, ({ jeuId, version: read, ...given }) => toolResult(async () => {
    requireWrite(event)
    await requireGameAccess(event, jeuId)
    const { definition } = await getCurrentRegistrationForm(jeuId)
    const shuffled = new Map(definition.questions.map((question) => [question.id, question.shuffleOptions]))
    const { baseVersionNumber: _base, ...parsed } = parseZod(registrationFormDefinitionSchema, {
      ...definition,
      ...given,
      ...(given.questions
        ? { questions: given.questions.map((question) => ({ shuffleOptions: question.id ? shuffled.get(question.id) : undefined, ...question })) }
        : {})
    })
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
    title: 'Décider d’une personne pour une session',
    description: 'Retient une personne du vivier pour une session (retain), la met en liste d’attente (waitlist) ou l’en retire (unwaitlist), ou la remet à sa dernière réponse (reset). Rien n’est annoncé ni envoyé : l’équipe annonce elle-même. Une décision déjà annoncée pour cette session se change dans l’interface.',
    inputSchema: z.object({
      inscriptionId: z.string(),
      version,
      action: z.enum(REGISTRATION_SELECTION_ACTIONS),
      sessionId: z.string().describe('La session concernée')
    }),
    annotations: WRITE
  }, ({ inscriptionId, version: read, action, sessionId }) => toolResult(async () => {
    requireWrite(event)
    const registration = await findRegistrationOr404(inscriptionId)
    await requireGameAccess(event, registration.period.gameId)
    const body = parseZod(registrationSelectionSchema, { action, sessionId })
    await withVersion(event, read, async () => {
      await assertUnmodifiedSince(event, 'registration', registration.id)
      const line = await prisma.registrationSession.findUnique({ where: { registrationId_sessionId: { registrationId: registration.id, sessionId: body.sessionId } }, select: { announcedStatus: true } })
      if (line?.announcedStatus) {
        throw createError({ statusCode: 409, message: 'Une décision a déjà été annoncée à cette personne pour cette session : changez-la dans l’interface.' })
      }
      await applySelection(registration.id, body.action, body.sessionId, await requireCurrentUser(event))
    })
    // Nom tenu par l'équipe du jeu (ADR-0086)
    const { updatedAt, participant } = await withGameValues(await prisma.registration.findUniqueOrThrow({ where: { id: registration.id }, select: { updatedAt: true, gameId: true, participant: { select: { id: true } } } }))
    await logWrite(event, 'decider_inscription', AI_LOG_ACTIONS.changed, { type: 'registration', id: registration.id, name: participant.name, gameId: registration.period.gameId })
    return { id: registration.id, version: updatedAt }
  }))

  server.registerTool('ordonner_liste_attente', {
    title: 'Ordonner une liste d’attente',
    description: 'Fixe l’ordre de la liste d’attente d’une session : les personnes en attente, de la première à la dernière.',
    inputSchema: z.object({ periodeId: z.string(), version, sessionId: z.string(), inscriptionIds: z.array(z.string()).max(1000) }),
    annotations: WRITE
  }, ({ periodeId, version: read, sessionId, inscriptionIds }) => toolResult(async () => {
    requireWrite(event)
    const period = await withVersion(event, read, () => requirePeriod(event, periodeId))
    const result = await reorderWaitlist(period.id, sessionId, inscriptionIds)
    await logWrite(event, 'ordonner_liste_attente', AI_LOG_ACTIONS.changed, { type: 'registrationPeriod', id: period.id, name: POOL_NAME, gameId: period.gameId })
    return result
  }))

  server.registerTool('tirer_au_sort', {
    title: 'Tirer au sort',
    description: 'Tire au sort les pré-inscrits d’une session en mode tirage ou mixte. Les personnes sans place vont en liste d’attente dans la limite réglée, les autres restent pré-inscrites. Les décisions restent à annoncer par l’équipe ; rien n’est envoyé.',
    inputSchema: z.object({ periodeId: z.string(), version, sessionId: z.string() }),
    annotations: WRITE
  }, ({ periodeId, version: read, sessionId }) => toolResult(async () => {
    requireWrite(event)
    const period = await withVersion(event, read, () => requirePeriod(event, periodeId))
    // Le tirage décide pour les pré-inscrits : aucune ne doit avoir déjà reçu une annonce pour cette session
    if (await prisma.registrationSession.count({ where: { sessionId, status: REGISTRATION_SESSION_STATUSES.preregistered, announcedStatus: { not: null } } })) {
      throw createError({ statusCode: 409, message: 'Une personne à tirer a déjà reçu une annonce : lancez ce tirage depuis l’interface.' })
    }
    const draw = await drawSession(period.id, sessionId, await requireCurrentUser(event))
    await logWrite(event, 'tirer_au_sort', AI_LOG_ACTIONS.created, { type: 'registrationDraw', id: draw.id, name: POOL_NAME, gameId: period.gameId })
    return draw
  }))

  server.registerTool('annuler_tirage', {
    title: 'Annuler un tirage',
    description: 'Annule un tirage tant que rien n’en est annoncé : ses personnes repartent pré-inscrites.',
    inputSchema: z.object({ tirageId: z.string(), version: version.describe('Version lue du vivier') }),
    annotations: { ...WRITE, destructiveHint: true }
  }, ({ tirageId, version: read }) => toolResult(async () => {
    requireWrite(event)
    const draw = await prisma.registrationDraw.findUnique({ where: { id: tirageId }, select: { id: true, periodId: true } })
    if (!draw) throw createError({ statusCode: 404, message: 'Tirage introuvable' })
    const period = await withVersion(event, read, () => requirePeriod(event, draw.periodId))
    const result = await cancelDraw(draw.id, await requireCurrentUser(event))
    await logWrite(event, 'annuler_tirage', AI_LOG_ACTIONS.changed, { type: 'registrationDraw', id: draw.id, name: POOL_NAME, gameId: period.gameId })
    return result
  }))
}

export function registerRegistrationWriteTools(context: ToolContext) {
  if (!context.event.context.aiAuthorization?.canWrite) return
  registerPeriodTools(context)
  registerFormTools(context)
  registerSelectionTools(context)
}
