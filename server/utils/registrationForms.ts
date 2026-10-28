import { z } from 'zod'
import { prisma } from '~/server/utils/prisma'
import {
  DEFAULT_REGISTRATION_FORM_DEFINITION,
  normalizeRegistrationFormDefinition,
  sameRegistrationFormDefinition,
  type RegistrationFormDefinition,
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
    definition: version
      ? normalizeRegistrationFormDefinition(version.definition as RegistrationFormDefinition)
      : DEFAULT_REGISTRATION_FORM_DEFINITION
  }
}

/**
 * Enregistre une définition : une nouvelle version immuable si elle diffère de la version en vigueur (R9),
 * sinon rien. Deux enregistrements simultanés se départagent sur l'unicité (formId, number) : 409.
 */
export async function saveRegistrationFormDefinition(gameId: string, definition: RegistrationFormDefinition) {
  const normalized = normalizeRegistrationFormDefinition(definition)
  const current = await getCurrentRegistrationForm(gameId)
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

const optionalAnswer = z.string().trim().max(500).optional().nullable().transform((value) => value || null)
// Un champ laissé vide arrive comme null : même message que pour une chaîne vide
const requiredAnswer = (label: string) => z.string({ error: `${label} est obligatoire` }).trim().min(1, `${label} est obligatoire`).max(500)

function answerField(definition: RegistrationFormDefinition, key: RegistrationStandardFieldKey, label: string) {
  const setting = definition.standardFields[key]
  if (!setting.asked) return z.unknown().optional().transform(() => null)
  return setting.required ? requiredAnswer(label) : optionalAnswer
}

/**
 * Schéma des réponses d'un inscrit aux champs standards, construit à partir d'une version du formulaire.
 * Un champ non demandé est ignoré (null) même s'il est envoyé : on ne stocke que ce qui a été demandé.
 */
export function registrationAnswerSchema(rawDefinition: RegistrationFormDefinition) {
  const definition = normalizeRegistrationFormDefinition(rawDefinition)

  return z.object({
    email: z.string({ error: 'L’email est obligatoire' }).trim().toLowerCase().email('Email invalide'),
    lastName: answerField(definition, 'lastName', 'Le nom'),
    firstName: answerField(definition, 'firstName', 'Le prénom'),
    facebookName: answerField(definition, 'facebookName', 'Le nom Facebook'),
    phone: answerField(definition, 'phone', 'Le téléphone'),
    emergencyContactName: answerField(definition, 'emergencyContact', 'Le nom du contact d’urgence'),
    emergencyContactPhone: answerField(definition, 'emergencyContact', 'Le téléphone du contact d’urgence'),
    dietary: answerField(definition, 'dietary', 'Les allergies et intolérances'),
    // Adhésion à la note d'intention : toujours obligatoire (R8)
    charterAccepted: z.literal(true, { error: 'L’adhésion à la note d’intention est obligatoire' }),
    healthConsent: z.boolean().optional().default(false)
  }).refine((answers) => !answers.dietary || answers.healthConsent, {
    // Données de santé (art. 9 RGPD) : pas d'allergies enregistrées sans consentement explicite (R14)
    message: 'Le consentement est nécessaire pour enregistrer des allergies ou intolérances',
    path: ['healthConsent']
  })
}
