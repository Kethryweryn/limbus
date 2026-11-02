// Dates en toutes lettres (« 2 novembre 2026 »), communes aux écrans, aux emails et aux pages publiques

type DateValue = string | Date

/** Fuseau d'un email ou d'une page publique : celui du jeu, pas celui du serveur ni de l'appareil. */
export const PARIS_TIME_ZONE = 'Europe/Paris'

/** Jour en toutes lettres ; sans fuseau, celui de l'appareil. */
export const formatLongDate = (value: DateValue, timeZone?: string) => new Date(value).toLocaleDateString('fr-FR', { dateStyle: 'long', timeZone })

/** Jour en toutes lettres et heure. */
export const formatLongDateTime = (value: DateValue, timeZone?: string) => new Date(value).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone })
