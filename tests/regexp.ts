// Texte à chercher tel quel dans une expression régulière (tests d'intégration et de bout en bout)
export const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
