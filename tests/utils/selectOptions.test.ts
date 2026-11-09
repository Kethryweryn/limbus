// US-205 : l'option « Aucun… » d'une liste de choix a une valeur réservée, traduite en chaîne vide dans les données
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { fromSelectValue, NONE_VALUE, noneOption, selectModel, toSelectValue } from '~/utils/selectOptions'
import { emptyStringModel } from '~/utils/writingDrafts'

describe('option « Aucun » d’une liste de choix', () => {
  it('n’a jamais une valeur vide, que Reka UI refuse', () => {
    expect(noneOption('Aucun lieu')).toEqual({ label: 'Aucun lieu', value: NONE_VALUE })
    expect(NONE_VALUE).not.toBe('')
  })

  it('se traduit dans les deux sens', () => {
    expect(toSelectValue('')).toBe(NONE_VALUE)
    expect(toSelectValue(null)).toBe(NONE_VALUE)
    expect(toSelectValue(undefined)).toBe(NONE_VALUE)
    expect(toSelectValue('lieu-1')).toBe('lieu-1')
    expect(fromSelectValue(NONE_VALUE)).toBe('')
    expect(fromSelectValue('')).toBe('')
    expect(fromSelectValue('lieu-1')).toBe('lieu-1')
  })

  it('le modèle lit et écrit la donnée sans la valeur réservée', () => {
    const data = ref({ locationId: '' })
    const model = selectModel(() => data.value.locationId, (value) => { data.value.locationId = value })
    expect(model.value).toBe(NONE_VALUE)
    model.value = 'lieu-1'
    expect(data.value.locationId).toBe('lieu-1')
    model.value = NONE_VALUE
    expect(data.value.locationId).toBe('')
  })

  it('le modèle d’un brouillon fait de même', () => {
    const draft = ref<{ locationCharacterId?: string | null }>({ locationCharacterId: null })
    const model = emptyStringModel(draft, 'locationCharacterId')
    expect(model.value).toBe(NONE_VALUE)
    model.value = 'perso-1'
    expect(draft.value.locationCharacterId).toBe('perso-1')
    model.value = NONE_VALUE
    expect(draft.value.locationCharacterId).toBe('')
  })
})
