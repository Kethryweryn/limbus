import { computed } from 'vue'

// Reka UI, sous le USelect de Nuxt UI, refuse une option de valeur vide : elle ne s'affiche pas, et la console signale
// une erreur (US-205). L'option « Aucun… » prend donc cette valeur, que le modèle traduit en chaîne vide.
export const NONE_VALUE = '__none'

export function noneOption(label: string) {
  return { label, value: NONE_VALUE }
}

export function toSelectValue(value: string | null | undefined) {
  return value || NONE_VALUE
}

export function fromSelectValue(value: string | null | undefined) {
  return !value || value === NONE_VALUE ? '' : value
}

/** Modèle d'une liste de choix dont « Aucun » vaut une chaîne vide dans les données. */
export function selectModel(get: () => string | null | undefined, set: (value: string) => void) {
  return computed({
    get: () => toSelectValue(get()),
    set: (value: string) => set(fromSelectValue(value))
  })
}
