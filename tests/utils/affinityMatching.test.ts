import { describe, expect, it } from 'vitest'
import { affinityLineKey, nameSimilarity, normalizeName, suggestPeople } from '~/utils/affinityMatching'

describe('similarité des noms (US-095)', () => {
  it('compare sans accents, casse ni ponctuation', () => {
    expect(normalizeName('  Léa-Marie  O’Neil ')).toBe('lea marie o neil')
    expect(normalizeName('Cœur Lætitia')).toBe('coeur laetitia')
    expect(nameSimilarity('LÉA', 'lea')).toBe(1)
  })

  it('reconnaît un nom abrégé ou partiel', () => {
    expect(nameSimilarity('Paul D.', 'Paul Durand')).toBe(0.9)
    expect(nameSimilarity('Durand', 'Paul Durand')).toBe(0.95)
    // Une initiale et un mot entier passent devant un simple début de mot
    expect(nameSimilarity('Paul D.', 'Paul Durand')).toBeGreaterThan(nameSimilarity('Paul D.', 'Paula Dupont'))
    expect(nameSimilarity('Paul Martin', 'Paul Durand')).toBeLessThan(0.6)
  })

  it('tolère une faute de frappe', () => {
    expect(nameSimilarity('Camile', 'Camille')).toBeGreaterThan(0.8)
  })

  it('propose trois personnes au plus, la plus proche en premier, au-dessus du seuil', () => {
    const people = [
      { id: '1', name: 'Paul Durand' },
      { id: '2', name: 'Paula' },
      { id: '3', name: 'Zacharie' },
      { id: '4', name: 'Paul' },
      { id: '5', name: 'Pauline Roy' }
    ]
    expect(suggestPeople('Paul', people).map((person) => person.id)).toEqual(['4', '1', '2'])
    expect(suggestPeople('Inconnue', people)).toEqual([])
  })

  it('une ligne garde son rattachement si sa sorte et son texte ne changent pas', () => {
    expect(affinityLineKey('avoid', ' Max ')).toBe(affinityLineKey('avoid', 'max'))
    expect(affinityLineKey('avoid', 'Max')).not.toBe(affinityLineKey('wantWith', 'Max'))
  })
})
