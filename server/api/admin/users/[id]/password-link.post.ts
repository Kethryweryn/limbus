import { prisma } from '~/server/utils/prisma'
import { assertActivatedForAdmin } from '~/server/utils/participantAccounts'
import { requireAdmin } from '~/server/utils/auth'
import { requireRouterParam } from '~/server/utils/routeParams'
import { ACCOUNT_TOKEN_KINDS, ACCOUNT_TOKEN_TTL, assertEmailEnabled, createAccountToken, passwordUrl } from '~/server/utils/accounts'
import { sendPasswordLinkEmail } from '~/server/utils/email'

// Envoyer à un compte un lien pour choisir son mot de passe (US-065)
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = requireRouterParam(event, 'id')
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, disabledAt: true } })
  if (!user) {
    throw createError({ statusCode: 404, message: 'Compte introuvable' })
  }
  if (user.disabledAt) {
    throw createError({ statusCode: 400, message: 'Ce compte est désactivé : réactivez-le d’abord.' })
  }
  // Compte non activé (US-248) : un mot de passe seul l'activerait sans nom ni conditions
  await assertActivatedForAdmin(user.id)
  await assertEmailEnabled()
  const token = await createAccountToken(user.id, ACCOUNT_TOKEN_KINDS.password, ACCOUNT_TOKEN_TTL.passwordCreated)
  await sendPasswordLinkEmail({ to: user.email, url: passwordUrl(token), created: false, validity: '7 jours' })
  return { success: true }
})
