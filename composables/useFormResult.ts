import { splitApiErrors } from '~/utils/apiErrors'

/** Résultat d'un formulaire, affiché sous son bouton par `FormFeedback` (US-216) : une erreur ou une confirmation. */
export type FormResult = { text: string, error: boolean }

/**
 * Résultat du dernier formulaire envoyé d'une page qui en a plusieurs, rangé sous la clé de sa carte : chaque carte
 * lit le sien par `resultFor`. `run` lance l'action, qui rend sa confirmation, ou null quand la page montre déjà le
 * changement ; un refus devient le message de l'erreur. `pending` est la clé de l'action en cours. Avec `fields`, les
 * refus de ces champs s'affichent sous eux (`errorsFor`, SPEC-023 R11), et le message ne garde que les autres.
 */
export function useFormResult<Key extends string>() {
  const result = ref<FormResult & { key: Key } | null>(null)
  const pending = ref<Key | null>(null)
  const fieldErrors = ref<{ key: Key, errors: Record<string, string> } | null>(null)

  const resultFor = (key: Key): FormResult | null => result.value?.key === key ? result.value : null
  const errorsFor = (key: Key): Record<string, string> => fieldErrors.value?.key === key ? fieldErrors.value.errors : {}

  async function run(key: Key, action: () => Promise<string | null>, fields: readonly string[] = []) {
    pending.value = key
    result.value = null
    fieldErrors.value = null
    try {
      const text = await action()
      if (text) result.value = { key, text, error: false }
    } catch (err) {
      const { fields: errors, message } = splitApiErrors(err, 'Erreur inconnue', fields)
      fieldErrors.value = { key, errors }
      result.value = { key, text: message, error: true }
    } finally {
      pending.value = null
    }
  }

  return { pending, resultFor, errorsFor, run }
}
