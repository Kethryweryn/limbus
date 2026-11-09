import { ref, watch } from 'vue'
import { withQueuedEdit } from '~/utils/writingDrafts'

/**
 * Formulaire d'une fiche (personnage, groupe, lieu, session…) : ouvert par `?edit=` dans l'adresse, pour survivre à
 * un rechargement, et refermé après l'enregistrement. Un enregistrement qui change le slug mène à la nouvelle
 * adresse sans revenir à celle de la page : l'ancien slug n'existe plus (« introuvable »).
 *
 * `draftOf` donne le brouillon tiré de la fiche lue, null tant qu'elle ne l'est pas.
 */
export function useSheetEdit<Draft>(draftOf: () => Draft | null, editValue = '1') {
  const route = useRoute()
  const router = useRouter()
  const isEditing = ref(route.query.edit === editValue)
  const draft = ref<Draft | null>(draftOf())

  watch(() => route.query.edit, (value) => {
    isEditing.value = value === editValue
    const next = draftOf()
    if (isEditing.value && next) draft.value = next
  })

  function queryWithoutEdit() {
    const query = { ...route.query }
    delete query.edit
    return query
  }

  function startEdit() {
    const next = draftOf()
    if (!next) return
    draft.value = next
    isEditing.value = true
    router.replace({ path: route.path, query: { ...route.query, edit: editValue } })
  }

  function cancelEdit() {
    isEditing.value = false
    draft.value = draftOf()
    router.replace({ path: route.path, query: queryWithoutEdit() })
  }

  /**
   * Après l'enregistrement : vers `path` si la fiche a changé d'adresse (nouveau slug), sinon relecture éventuelle
   * puis fermeture du formulaire sur place.
   */
  async function closeAfterSave(path: string | null, reload?: () => Promise<unknown>) {
    if (path && path !== route.path) {
      isEditing.value = false
      await router.replace({ path, query: queryWithoutEdit() })
      return
    }
    await reload?.()
    cancelEdit()
  }

  /**
   * Après un enregistrement mis en file hors ligne (ADR-0036) : la fiche montre la modification et ferme le formulaire,
   * sans relire sa copie sur l'appareil, qui est encore l'ancienne version (US-212).
   */
  function closeAfterQueued<Sheet extends object>(sheet: { value: Sheet | null | undefined }) {
    if (sheet.value && draft.value) sheet.value = withQueuedEdit(sheet.value, draft.value as object)
    cancelEdit()
  }

  return { isEditing, draft, startEdit, cancelEdit, closeAfterSave, closeAfterQueued }
}
