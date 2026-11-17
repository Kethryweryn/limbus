import { splitApiErrors } from '~/utils/apiErrors'

/**
 * Messages d'un formulaire sous ses champs (SPEC-023, R11) : `report` range le refus du serveur sous les champs
 * affichés (`fields`, tous s'il est absent) et rend le message à afficher sous le bouton.
 */
export function useFieldErrors(fields?: readonly string[]) {
  const fieldErrors = ref<Record<string, string>>({})

  function report(err: unknown, fallback: string) {
    const { fields: shown, message } = splitApiErrors(err, fallback, fields)
    fieldErrors.value = shown
    return message
  }

  function reset() {
    fieldErrors.value = {}
  }

  return { fieldErrors, report, reset }
}
