import { prisma, type PrismaTx } from '~/server/utils/prisma'
import { lockAddress } from '~/server/utils/participantAddress'
import { REGISTRATION_STATUSES } from '~/utils/domain'
import { splitParticipantName } from '~/utils/registrations'
import { normalizeRegistrationFormDefinition, type RegistrationFormDefinition } from '~/utils/registrationForms'

// Rattachement des fiches participant au compte de leur adresse (US-070, ADR-0041, ADR-0088)

/**
 * Compte de l'adresse d'une fiche, pré-créé non activé s'il n'existe pas (SPEC-022 R1, ADR-0088) : sans mot de passe,
 * nom, adresse confirmée ni conditions, et sans email. Toute fiche qui a une adresse appartient ainsi à un compte. La base
 * compare sans la casse (citext, ADR-0075) : seuls les espaces sont retirés. À appeler dans la transaction qui écrit la
 * fiche, sous le verrou de l'adresse (`lockAddress`).
 */
export async function accountForEmail(client: PrismaTx, email: string | null | undefined) {
  const normalized = email?.trim()
  if (!normalized) return null
  const account = await client.user.upsert({
    where: { email: normalized },
    create: { email: normalized, name: '', password: null, emailConfirmedAt: null },
    update: {},
    select: { id: true }
  })
  return account.id
}

/**
 * Supprime une fiche ; le compte non activé de son adresse, qui ne porte plus aucune fiche, part avec elle (SPEC-022 R13,
 * ADR-0090) : rien ne reste sur une personne qu'aucune équipe ne suit plus. Un compte activé reste, il suit la règle des
 * 24 mois, et un compte dont une inscription attend sa confirmation aussi : la personne veut ce compte, le nettoyage des
 * inscriptions non confirmées s'en charge sinon. À appeler dans la transaction de toute suppression de fiche ; le verrou
 * de l'adresse fait passer après elle une création de fiche à la même adresse, qui reprendrait ce compte (revue de la
 * PR #247).
 */
export async function deleteFiche(tx: PrismaTx, participantId: string) {
  const { email } = await tx.participant.findUniqueOrThrow({ where: { id: participantId }, select: { email: true } })
  if (email) await lockAddress(tx, email)
  const { userId } = await tx.participant.delete({ where: { id: participantId }, select: { userId: true } })
  if (!userId) return
  await tx.user.deleteMany({
    where: {
      id: userId,
      ...notActivatedAccount,
      participants: { none: {} },
      accountTokens: { none: { kind: 'confirm', usedAt: null, expiresAt: { gt: new Date() } } }
    }
  })
}

/**
 * Compte non activé (ADR-0088) : pré-créé pour une fiche, ou inscription jamais confirmée. Seul un compte activé, dont
 * l'adresse est confirmée, tient les coordonnées de ses fiches (ADR-0042).
 */
export const notActivatedAccount = { emailConfirmedAt: null } as const

// À la confirmation d'une adresse : toutes les fiches qui la portent, la base comparant sans la casse (ADR-0075)
export async function linkParticipantsToUser(user: { id: string, email: string }) {
  await prisma.participant.updateMany({
    where: { email: user.email.trim() },
    data: { userId: user.id }
  })
  // Une fiche qui vient d'être rattachée reçoit les coordonnées du compte (US-074)
  await syncProfileToParticipants(user.id)
}

/** Coordonnées qu'une personne peut tenir depuis son compte (ADR-0089) ; le contact d'urgence va par paire. */
export const PROFILE_FIELDS = ['name', 'phone', 'emergencyContact', 'dietary'] as const
export type ProfileField = typeof PROFILE_FIELDS[number]
/** Ceux qui vivent sur la fiche, par jeu (ADR-0086) : les autres vont sur les inscriptions. */
export const FICHE_PROFILE_FIELDS = ['name', 'phone'] as const satisfies readonly ProfileField[]

export type ProfileValues = {
  emailConfirmedAt: Date | null
  name: string
  phone: string | null
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
  dietary?: string | null
}

/**
 * Champs tenus par la personne (ADR-0089) : un champ non vide d'un compte activé. Le nom d'un compte activé est toujours
 * tenu ; un compte non activé ne tient rien. Un champ tenu remplace celui de chaque équipe, qui ne peut plus le changer.
 */
export function heldProfileFields(user: ProfileValues | null | undefined): ProfileField[] {
  if (!user?.emailConfirmedAt) return []
  const filled: Record<ProfileField, boolean> = {
    name: Boolean(user.name.trim()),
    phone: Boolean(user.phone),
    emergencyContact: Boolean(user.emergencyContactName || user.emergencyContactPhone),
    dietary: Boolean(user.dietary)
  }
  return PROFILE_FIELDS.filter((field) => filled[field])
}

/** Champs que la personne vient de vider : remplis avant l'enregistrement, vides après (ADR-0089). */
export function clearedProfileFields(before: ProfileValues, after: ProfileValues): ProfileField[] {
  const held = new Set(heldProfileFields(after))
  return heldProfileFields(before).filter((field) => !held.has(field))
}

/** Ce qu'il faut pour savoir si le nom et le téléphone d'une fiche sont tenus, sans lire l'urgence ni les allergies. */
export const ficheProfileSelect = { emailConfirmedAt: true, name: true, phone: true } as const

export const profileValuesSelect = {
  emailConfirmedAt: true, name: true, phone: true, emergencyContactName: true, emergencyContactPhone: true, dietary: true
} as const

/**
 * Coordonnées du compte recopiées champ par champ (ADR-0089, qui remplace en partie ADR-0042) : les champs tenus par la
 * personne, et ceux qu'elle vient de vider (`cleared`), vont sur toutes ses fiches (nom et téléphone de chaque jeu) et
 * sur ses inscriptions non désistées déjà remplies, pour les seuls champs que le formulaire de chacune a demandés. Un
 * champ jamais rempli n'est jamais écrit : chaque équipe garde le sien. Rien pour un compte non activé.
 */
export async function syncProfileToParticipants(userId: string, cleared: ProfileField[] = []) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { ...profileValuesSelect, healthConsentAt: true } })
  if (!user?.emailConfirmedAt) return
  const written = new Set<ProfileField>([...heldProfileFields(user), ...cleared])
  if (!written.size) return
  const { firstName, lastName } = splitParticipantName(user.name)
  // Inscriptions déjà remplies : seulement les champs que leur formulaire a demandés (on ne stocke que ce qui
  // a été demandé, R8). Une invitation sans réponse se préremplit à l'affichage
  const registrations = await prisma.registration.findMany({
    where: { participant: { userId }, status: { not: REGISTRATION_STATUSES.withdrawn }, formVersionId: { not: null } },
    select: { id: true, formVersion: { select: { definition: true } } }
  })
  const linkData = {
    ...(written.has('name') ? { name: user.name } : {}),
    ...(written.has('phone') ? { phone: user.phone } : {})
  }
  await prisma.$transaction([
    // Tenus par jeu (ADR-0086) : chaque jeu de ses fiches reçoit les champs du compte
    ...(Object.keys(linkData).length ? [prisma.participantGame.updateMany({ where: { participant: { userId } }, data: linkData })] : []),
    ...registrations.flatMap((registration) => {
      const asked = normalizeRegistrationFormDefinition(registration.formVersion!.definition as RegistrationFormDefinition).standardFields
      const data = {
        ...(written.has('name') && asked.firstName.asked ? { firstName } : {}),
        ...(written.has('name') && asked.lastName.asked ? { lastName: lastName || null } : {}),
        ...(written.has('phone') && asked.phone.asked ? { phone: user.phone } : {}),
        ...(written.has('emergencyContact') && asked.emergencyContact.asked ? { emergencyContactName: user.emergencyContactName, emergencyContactPhone: user.emergencyContactPhone } : {}),
        ...(written.has('dietary') && asked.dietary.asked ? { dietary: user.dietary, healthConsentAt: user.dietary ? user.healthConsentAt : null } : {})
      }
      // Rien de demandé parmi ces champs : l'inscription ne change pas, ni sa version
      return Object.keys(data).length ? [prisma.registration.update({ where: { id: registration.id }, data })] : []
    })
  ])
}

// Identifiants des fiches rattachées au compte : le point de départ de toute route de l'espace participant
export async function myParticipantIds(userId: string) {
  return (await prisma.participant.findMany({ where: { userId }, select: { id: true } })).map((participant) => participant.id)
}

/**
 * L'administration ne touche pas à un compte non activé (US-248, ADR-0088) : ni modification, ni lien de mot de passe,
 * ni désactivation, ni suppression. La personne l'active elle-même, ou l'administratrice le reprend en créant le compte
 * à son adresse.
 */
export async function assertActivatedForAdmin(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { emailConfirmedAt: true } })
  if (user && !user.emailConfirmedAt) {
    throw createError({ statusCode: 400, message: 'Ce compte n’est pas activé : créez-le avec son nom pour le reprendre, ou laissez la personne l’activer.' })
  }
}
