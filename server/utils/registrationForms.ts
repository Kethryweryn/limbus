import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'
import {
  DEFAULT_REGISTRATION_FORM_DEFINITION,
  REGISTRATION_AFFINITIES,
  REGISTRATION_AFFINITY_MAX_LENGTH,
  REGISTRATION_AFFINITY_MAX_LINES,
  REGISTRATION_ANSWER_MAX_LENGTH,
  REGISTRATION_DIETARY_MAX_LENGTH,
  REGISTRATION_QUESTION_TEXT_MAX_LENGTH,
  normalizeRegistrationFormDefinition,
  sameRegistrationFormDefinition,
  type NormalizedRegistrationFormDefinition,
  type RegistrationAffinityKey,
  type RegistrationFieldSetting,
  type RegistrationFormDefinition,
  type RegistrationQuestion,
  type RegistrationStandardFieldKey
} from '~/utils/registrationForms'

// Formulaire d'un jeu dans sa version en vigueur ; sans formulaire enregistré, la définition par défaut
export async function getCurrentRegistrationForm(gameId: string) {
  const version = await prisma.registrationFormVersion.findFirst({
    where: { form: { gameId } },
    orderBy: { number: 'desc' },
    select: { id: true, number: true, definition: true, createdAt: true }
  })

  return {
    version: version ? { id: version.id, number: version.number, createdAt: version.createdAt } : null,
    definition: normalizeRegistrationFormDefinition(version ? version.definition as RegistrationFormDefinition : DEFAULT_REGISTRATION_FORM_DEFINITION)
  }
}

/**
 * Enregistre une définition : une nouvelle version immuable si elle diffère de la version en vigueur (R9),
 * sinon rien. Deux enregistrements simultanés se départagent sur l'unicité (formId, number) : 409.
 */
export async function saveRegistrationFormDefinition(gameId: string, definition: RegistrationFormDefinition, baseVersionNumber?: number | null) {
  const current = await getCurrentRegistrationForm(gameId)
  // Une nouvelle question reçoit son identifiant, qui la suit d'une version à l'autre (ADR-0045) ; changer de sorte
  // en fait une autre question : ses réponses d'avant n'ont plus le même sens
  const currentTypes = new Map(current.definition.questions.map((question) => [question.id, question.type]))
  const normalized = normalizeRegistrationFormDefinition({
    ...definition,
    questions: definition.questions?.map((question) => {
      const kept = question.id && (!currentTypes.has(question.id) || currentTypes.get(question.id) === question.type)
      return { ...question, id: kept ? question.id : randomUUID() }
    })
  })
  // L'éditeur s'appuyait sur une version dépassée : enregistrer écraserait les changements d'une autre organisatrice
  if (baseVersionNumber !== undefined && (current.version?.number ?? null) !== baseVersionNumber) {
    throw createError({ statusCode: 409, message: 'Le formulaire a été modifié par quelqu’un d’autre depuis son ouverture : rechargez-le avant d’enregistrer.' })
  }
  if (current.version && sameRegistrationFormDefinition(current.definition, normalized)) {
    return current
  }

  try {
    await prisma.$transaction(async (tx) => {
      const form = await tx.registrationForm.upsert({
        where: { gameId },
        create: { gameId },
        update: {}
      })
      await tx.registrationFormVersion.create({
        data: { formId: form.id, number: (current.version?.number ?? 0) + 1, definition: normalized }
      })
    })
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2002') {
      throw createError({ statusCode: 409, message: 'Le formulaire vient d’être modifié par quelqu’un d’autre : rechargez-le avant d’enregistrer.' })
    }
    throw error
  }

  return await getCurrentRegistrationForm(gameId)
}

const tooLong = (label: string, max: number) => `${label} : ${max} caractères au plus`
const optionalAnswer = (label: string, max: number) =>
  z.string().trim().max(max, tooLong(label, max)).optional().nullable().transform((value) => value || null)
// Un champ laissé vide arrive comme null : même message que pour une chaîne vide
const requiredAnswer = (label: string, max: number) =>
  z.string({ error: `${label} est obligatoire` }).trim().min(1, `${label} est obligatoire`).max(max, tooLong(label, max))

function answerField(definition: NormalizedRegistrationFormDefinition, key: RegistrationStandardFieldKey, label: string, max = REGISTRATION_ANSWER_MAX_LENGTH) {
  const setting = definition.standardFields[key]
  if (!setting.asked) return z.unknown().optional().transform(() => null)
  return setting.required ? requiredAnswer(label, max) : optionalAnswer(label, max)
}

// Une affinité : une ligne par personne ou relation citée, lignes vides retirées (US-082)
function affinityField(setting: RegistrationFieldSetting, label: string) {
  if (!setting.asked) return z.unknown().optional().transform((): string[] => [])
  // Les lignes vides sont retirées avant de compter : une ligne laissée en fin de saisie ne compte pas
  const lines = z.preprocess(
    (values) => Array.isArray(values) ? values.filter((value) => typeof value !== 'string' || value.trim()) : values ?? [],
    z.array(z.string().trim().max(REGISTRATION_AFFINITY_MAX_LENGTH, `${label} : ${REGISTRATION_AFFINITY_MAX_LENGTH} caractères au plus par ligne`))
      .max(REGISTRATION_AFFINITY_MAX_LINES, `${label} : ${REGISTRATION_AFFINITY_MAX_LINES} lignes au plus`)
  )
  return setting.required ? lines.refine((values) => values.length > 0, `${label} : réponse obligatoire`) : lines
}

// Réponse à une question propre au jeu (US-081) : une option inconnue est refusée
function questionField(question: RegistrationQuestion) {
  const label = `« ${question.label} »`
  const missing = `${label} : réponse obligatoire`
  if (question.type === 'text') {
    return question.required ? requiredAnswer(label, REGISTRATION_QUESTION_TEXT_MAX_LENGTH) : optionalAnswer(label, REGISTRATION_QUESTION_TEXT_MAX_LENGTH)
  }
  if (question.type === 'scale') {
    const scale = z.number({ error: (issue) => issue.input == null ? missing : `${label} : choisissez une valeur de 1 à 5` }).int().min(1).max(5)
    return question.required ? scale : scale.optional().nullable().transform((value) => value ?? null)
  }
  const option = z.enum(question.options as [string, ...string[]], { error: (issue) => issue.input == null ? missing : `${label} : option inconnue` })
  if (question.type === 'single') {
    return question.required ? option : option.optional().nullable().transform((value) => value ?? null)
  }
  const options = z.array(option).optional().nullable().transform((values) => [...new Set(values ?? [])])
  return question.required ? options.refine((values) => values.length > 0, missing) : options
}

export type QuestionAnswers = Record<string, string | string[] | number | null>
export type AffinityAnswers = Record<RegistrationAffinityKey, string[]>

/**
 * Schéma des réponses d'un inscrit, construit à partir d'une version du formulaire.
 * Un champ non demandé est ignoré (null) même s'il est envoyé : on ne stocke que ce qui a été demandé.
 * Une réponse à une question absente de cette version est ignorée aussi (ADR-0045).
 */
export function registrationAnswerSchema(rawDefinition: RegistrationFormDefinition) {
  const definition = normalizeRegistrationFormDefinition(rawDefinition)
  // Absents, ils valent un objet vide : une réponse obligatoire est alors bien refusée
  const affinities = z.preprocess((value) => value ?? {}, z.object(Object.fromEntries(REGISTRATION_AFFINITIES.map(({ key, label }) =>
    [key, affinityField(definition.affinities[key], label)]
  )))).transform((value) => value as AffinityAnswers)
  const questionAnswers = z.preprocess((value) => value ?? {}, z.object(Object.fromEntries(definition.questions.map((question) => [question.id, questionField(question)]))))
    .transform((value) => value as QuestionAnswers)

  return z.object({
    email: z.string({ error: 'L’email est obligatoire' }).trim().toLowerCase().max(254, 'Email trop long').email('Email invalide'),
    lastName: answerField(definition, 'lastName', 'Le nom'),
    firstName: answerField(definition, 'firstName', 'Le prénom'),
    facebookName: answerField(definition, 'facebookName', 'Le nom Facebook'),
    phone: answerField(definition, 'phone', 'Le téléphone'),
    emergencyContactName: answerField(definition, 'emergencyContact', 'Le nom du contact d’urgence'),
    emergencyContactPhone: answerField(definition, 'emergencyContact', 'Le téléphone du contact d’urgence'),
    dietary: answerField(definition, 'dietary', 'Les allergies et intolérances', REGISTRATION_DIETARY_MAX_LENGTH),
    // Adhésion à la note d'intention : toujours obligatoire (R8)
    charterAccepted: z.literal(true, { error: 'L’adhésion à la note d’intention est obligatoire' }),
    healthConsent: z.boolean().optional().default(false),
    affinities,
    questionAnswers
  }).refine((answers) => !answers.dietary || answers.healthConsent, {
    // Données de santé (art. 9 RGPD) : pas d'allergies enregistrées sans consentement explicite (R14)
    message: 'Le consentement est nécessaire pour enregistrer des allergies ou intolérances',
    path: ['healthConsent']
  })
}
