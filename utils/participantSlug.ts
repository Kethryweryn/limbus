/**
 * Adresse de page d'une fiche participant (SPEC-022, US-239) : neutre, sans le nom, et fixée à la création. Une fiche
 * est suivie par plusieurs équipes, chacune avec son nom : une adresse faite d'un nom montrerait aux autres celui
 * qu'une équipe a choisi. Dix caractères tirés au hasard : la collision est négligeable, et la base la refuserait.
 */
const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'

export function participantSlug(random: (size: number) => Uint8Array = (size) => crypto.getRandomValues(new Uint8Array(size))) {
  return `p-${[...random(10)].map((byte) => ALPHABET[byte % ALPHABET.length]).join('')}`
}

export const isParticipantSlug = (slug: string) => /^p-[a-z2-9]{10}$/.test(slug)
