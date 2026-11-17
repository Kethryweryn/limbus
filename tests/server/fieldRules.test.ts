import { describe, expect, it } from 'vitest'
import { isPersonName, optionalPersonName, personName } from '~/server/utils/fieldRules'

const message = 'Le nom ne peut contenir que des lettres, des espaces, des traits d’union, des apostrophes et des points'

describe('personName (SPEC-023, R1)', () => {
  it('accepte les lettres de tout alphabet et les séparateurs', () => {
    for (const name of ['Jean-Pierre O\'Neill', 'Zoë Ŝ. Müller', 'Мария', 'Anaïs D’Arc', '\'t Hooft', 'Lê Văn Thành']) {
      expect(isPersonName(name), name).toBe(true)
    }
  })

  it('refuse un chiffre, un symbole ou un nom sans lettre', () => {
    for (const name of ['Jean2', '@lice', '-', '. \'', 'Léa_Martin', 'Bob 🙂']) {
      expect(isPersonName(name), name).toBe(false)
    }
    const refused = personName().safeParse('Jean2')
    expect(refused.success).toBe(false)
    expect(refused.error?.issues[0]?.message).toBe(message)
  })

  it('retire les espaces en double ou aux extrémités', () => {
    expect(personName().parse('  Jean   Martin ')).toBe('Jean Martin')
  })

  it('exige un nom, de 100 caractères au plus', () => {
    expect(personName().safeParse('   ').error?.issues[0]?.message).toBe('Le nom est obligatoire')
    expect(personName().safeParse(undefined).error?.issues[0]?.message).toBe('Le nom est obligatoire')
    expect(personName().safeParse('a'.repeat(101)).error?.issues[0]?.message).toBe('Le nom : 100 caractères au plus')
    expect(personName().parse('a'.repeat(100))).toHaveLength(100)
  })

  it('facultatif : vide ou absent devient null, sinon la même règle', () => {
    const optional = optionalPersonName('Le nom du contact d’urgence')
    expect(optional.parse('')).toBeNull()
    expect(optional.parse('  ')).toBeNull()
    expect(optional.parse(null)).toBeNull()
    expect(optional.parse(undefined)).toBeNull()
    expect(optional.parse(' Paul  Martin')).toBe('Paul Martin')
    expect(optional.safeParse('Paul 2').error?.issues[0]?.message).toBe('Le nom du contact d’urgence ne peut contenir que des lettres, des espaces, des traits d’union, des apostrophes et des points')
  })
})
