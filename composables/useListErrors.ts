import { splitListErrors } from '~/utils/apiErrors'

/**
 * Messages d'une liste éditée d'un bloc sous les champs de chaque ligne (SPEC-023, R11), pendant de useFieldErrors :
 * `report` range le refus du serveur par identifiant de ligne (`ids`, dans l'ordre de l'envoi) et rend le message à
 * afficher sous le bouton.
 */
export function useListErrors(list: string, fields: readonly string[]) {
  const rowErrors = ref<Record<string, Record<string, string>>>({})

  function report(err: unknown, fallback: string, ids: readonly string[]) {
    const { rows, message } = splitListErrors(err, fallback, list, ids, fields)
    rowErrors.value = rows
    return message
  }

  function reset() {
    rowErrors.value = {}
  }

  return { rowErrors, report, reset }
}
