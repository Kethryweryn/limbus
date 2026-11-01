// Information sur les photos des participants (US-107, SPEC-012 P1, ADR-0054) : le même texte partout

export const PHOTO_RETENTION_DEFAULT_MONTHS = 6
export const PHOTO_RETENTION_MIN_MONTHS = 1
export const PHOTO_RETENTION_MAX_MONTHS = 60

const months = (count: number) => `${count} mois`

/** Texte d'information : usage, destinataires, durée, et comment demander le retrait. */
export function photoInformation({ retentionMonths, contactEmail }: { retentionMonths: number, contactEmail: string | null }) {
  const contact = contactEmail ? `, ou en écrivant à ${contactEmail}` : ''
  // Tournure impersonnelle : le texte sert dans les emails (tutoiement) comme dans les formulaires (vouvoiement)
  return `Photos : l’équipe peut ajouter la photo de chaque participant au trombinoscope de la session, remis à l’équipe et envoyé aux joueurs de la session pour qu’ils reconnaissent les personnages. Elle est supprimée ${months(retentionMonths)} après la session. Chacun peut faire retirer la sienne à tout moment, depuis son compte Limbus (« Je participe »)${contact}.`
}

/** Adresse donnée pour le retrait : le contact du jeu, à défaut celle de la propriétaire. */
export function photoContactEmail(game: { contactEmail?: string | null, owner?: { email: string } | null }) {
  return game.contactEmail || game.owner?.email || null
}

/** Texte d'information d'un jeu, avec sa durée et son adresse de contact. */
export function gamePhotoInformation(game: { photoRetentionMonths: number, contactEmail?: string | null, owner?: { email: string } | null }) {
  return photoInformation({ retentionMonths: game.photoRetentionMonths, contactEmail: photoContactEmail(game) })
}
