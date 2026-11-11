import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { findRegistrationOr404, withSessionPresence } from '~/server/utils/registrations'
import { registrationListSelect } from '~/server/utils/registrationPeriods'
import { affinitiesForTeam } from '~/server/utils/registrationAffinities'
import { currentQuestionLinks } from '~/server/utils/registrationQuestionLinks'
import { normalizeRegistrationFormDefinition, type RegistrationFormDefinition } from '~/utils/registrationForms'
import type { QuestionAnswers } from '~/server/utils/registrationForms'
import { withGameValues } from '~/server/utils/participantValues'

// Détail d'une inscription pour les organisatrices du jeu (US-005) : réponses au formulaire comprises,
// allergies et date du consentement (données de santé, R14), questions et affinités (US-081, US-082), lues avec
// la version du formulaire que la personne a remplie (R9) ; affinités rattachées aux personnes du jeu (US-095)
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const { id, period } = await findRegistrationOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, period.gameId)
  setHeader(event, 'cache-control', 'private, no-store')

  // Nom tenu par l'équipe du jeu (ADR-0086)
  const registration = await withGameValues(await prisma.registration.findUniqueOrThrow({
    where: { id },
    select: {
      ...registrationListSelect,
      firstName: true,
      lastName: true,
      facebookName: true,
      phone: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      dietary: true,
      healthConsentAt: true,
      charterAcceptedAt: true,
      questionAnswers: true,
      balancePreference: true,
      formVersion: { select: { number: true, definition: true } }
    }
  }))
  const game = await prisma.game.findUnique({ where: { id: period.gameId }, select: { balanceAttribute: true, balanceValues: true } })
  const [withPresence] = await withSessionPresence([registration])
  const { formVersion, ...rest } = withPresence!
  // Lignes d'affinité avec la personne rattachée et des suggestions (US-095)
  const affinities = await affinitiesForTeam({ id, participantId: registration.participant.id }, period.gameId)
  // Personnages, factions et intrigues que désignent les réponses (US-098)
  const questionLinks = await currentQuestionLinks(period.gameId, game ?? undefined)
  const definition = formVersion ? normalizeRegistrationFormDefinition(formVersion.definition as RegistrationFormDefinition) : null
  return {
    ...rest,
    formVersion: formVersion ? { number: formVersion.number } : null,
    // Colonne JSON écrite par la réponse au formulaire
    questionAnswers: rest.questionAnswers as QuestionAnswers | null,
    questions: definition?.questions ?? [],
    // Question d'équilibre demandée par la version remplie, avec le nom de l'attribut du jeu (US-091)
    balance: definition?.balance.asked && game?.balanceAttribute ? { label: game.balanceAttribute } : null,
    affinityLines: affinities.lines,
    gamePeople: affinities.people,
    questionLinks
  }
})
