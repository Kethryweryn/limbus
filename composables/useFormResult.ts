import { apiErrorMessage } from '~/utils/apiErrors'

/** Résultat d'un formulaire, affiché sous son bouton par `FormFeedback` (US-216) : une erreur ou une confirmation. */
export type FormResult = { text: string, error: boolean }

/**
 * Résultat du dernier formulaire envoyé d'une page qui en a plusieurs, rangé sous la clé de sa carte : chaque carte
 * lit le sien par `resultFor`. `run` lance l'action, qui rend sa confirmation, ou null quand la page montre déjà le
 * changement ; un refus devient le message de l'erreur. `pending` est la clé de l'action en cours.
 */
export function useFormResult<Key extends string>() {
  const result = ref<FormResult & { key: Key } | null>(null)
  const pending = ref<Key | null>(null)

  const resultFor = (key: Key): FormResult | null => result.value?.key === key ? result.value : null

  async function run(key: Key, action: () => Promise<string | null>) {
    pending.value = key
    result.value = null
    try {
      const text = await action()
      if (text) result.value = { key, text, error: false }
    } catch (err) {
      result.value = { key, text: apiErrorMessage(err, 'Erreur inconnue'), error: true }
    } finally {
      pending.value = null
    }
  }

  return { pending, resultFor, run }
}
