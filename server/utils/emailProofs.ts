import { prisma, type PrismaTx } from '~/server/utils/prisma'
import { absoluteAppUrl } from '~/server/utils/appUrl'
import { sendEmail } from '~/server/utils/email'
import { lockAddress } from '~/server/utils/participantAddress'
import { moveParticipant } from '~/server/utils/participantWrites'
import { accountForEmail, syncProfileToParticipants } from '~/server/utils/participantAccounts'
import { createRegistrationToken, findParticipantByEmail, hashRegistrationToken } from '~/server/utils/registrations'
import { RETENTION } from '~/utils/legal'

/**
 * Preuve d'une adresse donnée en réponse, déjà celle d'une autre fiche (SPEC-022, US-243, ADR-0087) : un lien envoyé à
 * cette adresse, valable 7 jours ; preuve faite, la fiche d'origine rejoint celle de l'adresse prouvée.
 */
export const EMAIL_PROOF_TTL_MS = RETENTION.addressProofDays * 24 * 60 * 60 * 1000
const TOKEN_PATTERN = /^[\w-]{43}$/
export const INVALID_EMAIL_PROOF_MESSAGE = 'Ce lien n’est pas valable : il a peut-être déjà servi, ou il a expiré. Renvoyez votre réponse pour en recevoir un nouveau.'

export function emailProofEmailText(url: string) {
  return [
    'Bonjour,',
    '',
    'Cette adresse a été donnée en réponse à une invitation sur Limbus. Si c’est la vôtre, ouvrez ce lien pour le confirmer :',
    '',
    url,
    '',
    'Il est valable 7 jours. Votre inscription réunira alors tout ce que Limbus garde pour vous à cette adresse.',
    '',
    'Si vous n’êtes pas à l’origine de cette réponse, ignorez ce message : rien ne change.'
  ].join('\n')
}

// Un lien encore valable n'est pas renvoyé avant ce délai : une réponse corrigée plusieurs fois n'inonde pas l'adresse
const RESEND_AFTER_MS = 60 * 60 * 1000

/**
 * Une demande par fiche et par adresse : la nouvelle remplace la précédente, sauf si un lien valable est parti il y a
 * moins d'une heure (revue de la PR #236). Renvoie si l'email est parti ou était déjà en route.
 */
export async function requestEmailProof(participantId: string, email: string, now = new Date()) {
  const recent = await prisma.participantEmailProof.findFirst({
    where: { participantId, email, expiresAt: { gt: now }, createdAt: { gt: new Date(now.getTime() - RESEND_AFTER_MS) } },
    select: { id: true }
  })
  if (recent) return true
  const { token, tokenHash } = createRegistrationToken()
  await prisma.$transaction([
    prisma.participantEmailProof.deleteMany({ where: { participantId, email } }),
    prisma.participantEmailProof.create({ data: { participantId, email, tokenHash, expiresAt: new Date(now.getTime() + EMAIL_PROOF_TTL_MS) } })
  ])
  return await sendEmail({
    to: email,
    subject: 'Confirmez votre adresse pour Limbus',
    text: emailProofEmailText(absoluteAppUrl(`/inscription/adresse/${token}`))
  }).then((result) => result.sent).catch(() => false)
}

/**
 * Adresse prouvée (lien de preuve, ou adresse confirmée d'un compte) : tout ce que tient la fiche passe sur la fiche de
 * cette adresse, et ses inscriptions qui portaient l'ancienne adresse prennent la nouvelle ; la fiche d'origine
 * disparaît. Sans fiche à cette adresse, la fiche la prend. Renvoie le compte de l'adresse, à recopier ensuite.
 */
export async function adoptAddress(tx: PrismaTx, participantId: string, email: string) {
  const source = await tx.participant.findUniqueOrThrow({ where: { id: participantId }, select: { id: true, email: true, gameLinks: { select: { gameId: true } } } })
  const gameIds = source.gameLinks.map((link) => link.gameId)
  await lockAddress(tx, email)
  const target = await findParticipantByEmail(email, tx)
  const finalId = target && target.id !== source.id ? target.id : source.id
  const accountId = finalId === source.id ? await accountForEmail(tx, email) : target!.userId
  if (finalId === source.id) await tx.participant.update({ where: { id: source.id }, data: { email, userId: accountId } })
  else await moveParticipant(tx, source.id, finalId, gameIds)
  if (source.email) {
    await tx.registration.updateMany({ where: { participantId: finalId, gameId: { in: gameIds }, email: source.email }, data: { email } })
  }
  if (finalId !== source.id) await tx.participant.delete({ where: { id: source.id } })
  return accountId
}

/** Preuve faite par le lien : l'adresse est adoptée. Un jeton inconnu, déjà utilisé ou expiré est refusé pareil. */
export async function confirmEmailProof(token: string | undefined, now = new Date()) {
  const invalid = () => createError({ statusCode: 404, message: INVALID_EMAIL_PROOF_MESSAGE })
  if (!token || !TOKEN_PATTERN.test(token)) throw invalid()
  const proof = await prisma.participantEmailProof.findUnique({
    where: { tokenHash: hashRegistrationToken(token) },
    select: { id: true, email: true, expiresAt: true, participantId: true }
  })
  if (!proof || proof.expiresAt <= now) throw invalid()
  const userId = await prisma.$transaction(async (tx) => {
    // Un jeton ne sert qu'une fois : deux ouvertures simultanées n'en font qu'une
    const { count } = await tx.participantEmailProof.deleteMany({ where: { id: proof.id } })
    if (!count) throw invalid()
    return await adoptAddress(tx, proof.participantId, proof.email)
  })
  // Rattachée à un compte : ses jeux reçoivent les coordonnées que la personne a remplies (US-074)
  if (userId) await syncProfileToParticipants(userId)
  return { email: proof.email }
}

/** Demandes expirées : effacées au nettoyage (ADR-0087). */
export async function purgeEmailProofs(now = new Date()) {
  await prisma.participantEmailProof.deleteMany({ where: { expiresAt: { lte: now } } })
}
