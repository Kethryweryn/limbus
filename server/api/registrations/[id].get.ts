import { prisma } from '~/server/utils/prisma'
import { requireUser } from '~/server/utils/auth'
import { requireGameAccess } from '~/server/utils/gameAccess'
import { findRegistrationOr404, withSessionPresence } from '~/server/utils/registrations'
import { registrationListSelect } from '~/server/utils/registrationPeriods'
import { groupAffinities } from '~/server/utils/publicRegistrations'
import { normalizeRegistrationFormDefinition, type RegistrationFormDefinition } from '~/utils/registrationForms'

// Détail d'une inscription pour les organisatrices du jeu (US-005) : réponses au formulaire comprises,
// allergies et date du consentement (données de santé, R14), questions et affinités (US-081, US-082), lues avec
// la version du formulaire que la personne a remplie (R9)
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const { id, period } = await findRegistrationOr404(getRouterParam(event, 'id'))
  await requireGameAccess(event, period.gameId)
  setHeader(event, 'cache-control', 'private, no-store')

  const registration = await prisma.registration.findUniqueOrThrow({
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
      affinities: { select: { kind: true, text: true }, orderBy: { position: 'asc' } },
      formVersion: { select: { number: true, definition: true } },
      session: { select: { id: true, name: true } }
    }
  })
  const [withPresence] = await withSessionPresence([registration])
  const { formVersion, affinities, ...rest } = withPresence!
  const definition = formVersion ? normalizeRegistrationFormDefinition(formVersion.definition as RegistrationFormDefinition) : null
  return {
    ...rest,
    formVersion: formVersion ? { number: formVersion.number } : null,
    questions: definition?.questions ?? [],
    affinities: groupAffinities(affinities)
  }
})
