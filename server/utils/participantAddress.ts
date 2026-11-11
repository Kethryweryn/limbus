import type { PrismaTx } from './prisma'

/**
 * Deux écritures d'une même adresse de fiche passent l'une après l'autre (SPEC-022 R4, US-240) : la seconde trouve la
 * fiche de la première au lieu d'en créer une deuxième, que l'index unique de l'adresse refuserait. À prendre dans la
 * transaction, avant de chercher la fiche de l'adresse puis de la créer ou de changer une adresse.
 */
export async function lockAddress(tx: PrismaTx, address: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`participant-email:${address.trim().toLowerCase()}`}))`
}
