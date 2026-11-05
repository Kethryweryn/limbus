// Réglages du rechargement des jeux de test, tous lus dans l'environnement (ADR-0066)

const MIN_PASSWORD_LENGTH = 8
const DAY_MS = 24 * 60 * 60 * 1000

// Personnes fictives dont les emails arrivent vraiment : les comptes de test et trois personnes sans compte
const RECEIVING_LOCAL_PARTS = new Set([
  'ines.lefevre',
  'camille.bernard',
  'lucie.moreau',
  'nicolas.martin',
  'sarah.petit',
  'manon.richard'
])

export type SeedOptions = {
  // Compte propriétaire, et base des adresses qui reçoivent
  ownerEmail: string | null
  // Mot de passe des comptes de test ; sans lui, aucun compte de test n'est créé ni modifié
  password: string | null
  // Remplace aussi les jeux qui portent l'adresse de page d'un jeu de test, sans son identifiant fixe
  replaceBySlug: boolean
}

export function readSeedOptions(env: Record<string, string | undefined>): SeedOptions {
  if (env.SEED_ALLOW_ERASE !== '1') {
    throw new Error('Le rechargement remplace les jeux de test : relancer avec SEED_ALLOW_ERASE=1 pour confirmer.')
  }

  const ownerEmail = env.SEED_EMAIL?.trim().toLowerCase() || null
  if (ownerEmail && !/^[^@\s]+@[^@\s]+$/.test(ownerEmail)) {
    throw new Error('SEED_EMAIL doit être une adresse email.')
  }

  const password = env.SEED_PASSWORD || null
  if (password && password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`SEED_PASSWORD doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`)
  }

  return { ownerEmail, password, replaceBySlug: env.SEED_REPLACE_BY_SLUG === '1' }
}

// L'adresse réelle d'une personne fictive : nom+camille.bernard@domaine si elle reçoit, sinon celle du script
export function personAddress(fictionalEmail: string, ownerEmail: string | null) {
  const localPart = fictionalEmail.split('@')[0]!
  if (!ownerEmail || !RECEIVING_LOCAL_PARTS.has(localPart)) return fictionalEmail
  const [ownerLocal, domain] = ownerEmail.split('@')
  return `${ownerLocal}+${localPart}@${domain}`
}

// Midi UTC, pour que la date reste le même jour en France
export function daysFromNow(days: number, now = new Date()) {
  const noon = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12)
  return new Date(noon + days * DAY_MS)
}
