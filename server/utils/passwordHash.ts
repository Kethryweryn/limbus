import bcrypt from 'bcrypt'

export const BCRYPT_ROUNDS = 10

export async function hashPassword(password: string) {
  return await bcrypt.hash(password, BCRYPT_ROUNDS)
}

// Empreinte d'un mot de passe que personne ne connaît : comparer avec elle prend le même temps qu'avec une vraie
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('mot-de-passe-factice', BCRYPT_ROUNDS)

/**
 * Mot de passe saisi comparé à celui du compte. Un compte pré-créé n'en a pas (ADR-0088) : la comparaison échoue, en
 * autant de temps qu'avec un vrai, pour que la réponse ne révèle ni le compte ni son état.
 */
export async function passwordMatches(password: string, hash: string | null | undefined) {
  const match = await bcrypt.compare(password, hash ?? DUMMY_PASSWORD_HASH)
  return Boolean(hash) && match
}
