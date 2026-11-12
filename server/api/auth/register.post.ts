import { TERMS_VERSION } from '~/utils/legal'
import { prisma } from '~/server/utils/prisma'
import { setAuthCookie } from '~/server/utils/auth'
import { acceptInvitationForUser, createInvitedUser, getValidInvitation, normalizeInvitationEmail } from '~/server/utils/invitations'
import { invitationRegistrationSchema, readZodBody } from '~/server/utils/schemas'
import { hashPassword } from '~/server/utils/passwordHash'
import { linkParticipantsToUser } from '~/server/utils/participantAccounts'

export default defineEventHandler(async (event) => {
  const body = await readZodBody(event, invitationRegistrationSchema)
  // Le compte prend l'adresse invitée (US-064) : le lien reçu la prouve, il est confirmé d'emblée.
  // Ouvert même inscription libre fermée : c'est une invitation
  const invitation = await getValidInvitation(body.token)
  const email = normalizeInvitationEmail(invitation.email)

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailConfirmedAt: true }
  })
  if (existingUser?.emailConfirmedAt) {
    throw createError({
      statusCode: 409,
      message: 'Un compte existe déjà pour cette adresse. Connectez-vous pour accepter l’invitation.'
    })
  }

  const password = await hashPassword(body.password)
  // Conditions acceptées à la création du compte (US-111, ADR-0055)
  const terms = { termsAcceptedVersion: TERMS_VERSION, termsAcceptedAt: new Date() }
  // Compte non activé à cette adresse (pré-créé pour une fiche, ou inscription non confirmée) : l'invitation l'active
  // (SPEC-022 R2, R9, US-246), avec ses fiches ; les liens d'une inscription non confirmée tombent
  const user = existingUser
    ? (await prisma.$transaction([
        prisma.accountToken.deleteMany({ where: { userId: existingUser.id } }),
        prisma.user.update({
          where: { id: existingUser.id },
          data: { name: body.name, password, emailConfirmedAt: new Date(), ...terms, sessionVersion: { increment: 1 } },
          select: { id: true, email: true, name: true, role: true, sessionVersion: true }
        })
      ]))[1]
    : { ...await createInvitedUser(email, body.name, password), sessionVersion: 0 }
  if (!existingUser) await prisma.user.update({ where: { id: user.id }, data: terms })
  await linkParticipantsToUser(user)
  // Connectée dès la création : si l'acceptation échoue (legs annulé entre-temps…), elle n'a pas à recréer son compte.
  // Un compte repris change de version de session : une session ouverte par une inscription non confirmée tombe
  setAuthCookie(event, { id: user.id, sessionVersion: user.sessionVersion })
  const game = await acceptInvitationForUser(body.token, user.id)

  const { sessionVersion: _sessionVersion, ...account } = user
  return { success: true, user: account, game }
})
