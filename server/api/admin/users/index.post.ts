import { prisma } from '~/server/utils/prisma'
import { requireAdmin } from '~/server/utils/auth'
import { readZodBody, userCreateSchema } from '~/server/utils/schemas'
import { ACCOUNT_TOKEN_KINDS, ACCOUNT_TOKEN_TTL, assertEmailEnabled, createAccountToken, passwordUrl, unusablePassword } from '~/server/utils/accounts'
import { sendPasswordLinkEmail } from '~/server/utils/email'
import { linkParticipantsToUser } from '~/server/utils/participantAccounts'

// Création par l'administratrice (US-065) : la personne choisit son mot de passe par le lien reçu
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readZodBody(event, userCreateSchema)
  await assertEmailEnabled()

  const existing = await prisma.user.findUnique({ where: { email: body.email }, select: { id: true, emailConfirmedAt: true } })
  if (existing?.emailConfirmedAt) {
    throw createError({ statusCode: 409, message: 'Un compte existe déjà pour cette adresse.' })
  }
  // Compte non activé à cette adresse, pré-créé pour une fiche ou inscription jamais confirmée (ADR-0088) : il est repris,
  // avec ses fiches, et rien de ce qu'une inscription avait saisi ne reste
  const data = {
    email: body.email,
    name: body.name,
    password: await unusablePassword(),
    role: body.role,
    emailConfirmedAt: new Date(),
    termsAcceptedVersion: null,
    termsAcceptedAt: null
  }
  const select = { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true } as const
  // Les liens d'une inscription non confirmée tombent : l'un d'eux poserait le mot de passe d'un tiers
  const user = existing
    ? (await prisma.$transaction([
        prisma.accountToken.deleteMany({ where: { userId: existing.id } }),
        prisma.user.update({ where: { id: existing.id }, data, select })
      ]))[1]
    : await prisma.user.create({ data, select })
  // Adresse choisie par l'administratrice, confirmée d'emblée (ADR-0039) : les fiches s'y rattachent (US-070)
  await linkParticipantsToUser(user)
  const token = await createAccountToken(user.id, ACCOUNT_TOKEN_KINDS.password, ACCOUNT_TOKEN_TTL.passwordCreated)
  // Un échec d'envoi n'annule pas la création : « Envoyer un lien de mot de passe » le renvoie
  const emailSent = await sendPasswordLinkEmail({ to: user.email, url: passwordUrl(token), created: true, validity: '7 jours' })
    .then((outcome) => outcome.sent, () => false)
  return { ...user, emailSent }
})
