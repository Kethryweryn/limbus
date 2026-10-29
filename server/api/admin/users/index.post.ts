import { prisma } from '~/server/utils/prisma'
import { requireAdmin } from '~/server/utils/auth'
import { readZodBody, userCreateSchema } from '~/server/utils/schemas'
import { ACCOUNT_TOKEN_KINDS, ACCOUNT_TOKEN_TTL, assertEmailEnabled, createAccountToken, passwordUrl, unusablePassword } from '~/server/utils/accounts'
import { sendPasswordLinkEmail } from '~/server/utils/email'

// Création par l'administratrice (US-065) : la personne choisit son mot de passe par le lien reçu
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readZodBody(event, userCreateSchema)
  await assertEmailEnabled()

  if (await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } })) {
    throw createError({ statusCode: 409, message: 'Un compte existe déjà pour cette adresse.' })
  }
  const user = await prisma.user.create({
    data: {
      email: body.email,
      name: body.name,
      password: await unusablePassword(),
      role: body.role
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true
    }
  })
  const token = await createAccountToken(user.id, ACCOUNT_TOKEN_KINDS.password, ACCOUNT_TOKEN_TTL.passwordCreated)
  // Un échec d'envoi n'annule pas la création : « Envoyer un lien de mot de passe » le renvoie
  const emailSent = await sendPasswordLinkEmail({ to: user.email, url: passwordUrl(token), created: true, validity: '7 jours' })
    .then((outcome) => outcome.sent, () => false)
  return { ...user, emailSent }
})
