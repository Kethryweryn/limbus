import { z } from 'zod'

/**
 * Adresse d'une fiche (SPEC-022 R3, US-238) : obligatoire et bien formée, vérifiée comme par le serveur, pour qu'une
 * modification faite hors ligne ne parte pas en file avant d'être refusée au retour du réseau.
 */
export const isParticipantEmail = (value: string | null | undefined) => z.string().trim().email().safeParse(value ?? '').success

/** Fiche à compléter : sans adresse, ou d'une adresse mal formée d'avant la vérification. */
export const needsParticipantEmail = (value: string | null | undefined) => !isParticipantEmail(value)
