// US-245 (ADR-0089) : champs tenus par la personne, et champs qu'elle vient de vider
import { describe, expect, it } from 'vitest'
import { clearedProfileFields, heldProfileFields } from '~/server/utils/participantAccounts'

const empty = { emailConfirmedAt: new Date(), name: 'Camille', phone: null, emergencyContactName: null, emergencyContactPhone: null, dietary: null }

describe('heldProfileFields', () => {
  it('un compte activé tient son nom et les seuls champs remplis', () => {
    expect(heldProfileFields(empty)).toEqual(['name'])
    expect(heldProfileFields({ ...empty, phone: '+33600000000', emergencyContactPhone: '+33644444444' })).toEqual(['name', 'phone', 'emergencyContact'])
    expect(heldProfileFields({ ...empty, dietary: 'Sans gluten' })).toEqual(['name', 'dietary'])
  })

  it('un compte non activé, ou absent, ne tient rien', () => {
    expect(heldProfileFields({ ...empty, emailConfirmedAt: null, phone: '+33600000000' })).toEqual([])
    expect(heldProfileFields(null)).toEqual([])
  })

  it('un nom vide n’est pas tenu', () => {
    expect(heldProfileFields({ ...empty, name: '  ' })).toEqual([])
  })
})

describe('clearedProfileFields', () => {
  it('rend les champs remplis avant et vides après, pas ceux jamais remplis', () => {
    const before = { ...empty, phone: '+33600000000', dietary: 'Sans gluten' }
    expect(clearedProfileFields(before, { ...before, phone: null })).toEqual(['phone'])
    expect(clearedProfileFields(empty, { ...empty, phone: '+33600000000' })).toEqual([])
    expect(clearedProfileFields(before, before)).toEqual([])
  })
})
