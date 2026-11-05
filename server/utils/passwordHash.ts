import bcrypt from 'bcrypt'

export const BCRYPT_ROUNDS = 10

export async function hashPassword(password: string) {
  return await bcrypt.hash(password, BCRYPT_ROUNDS)
}
