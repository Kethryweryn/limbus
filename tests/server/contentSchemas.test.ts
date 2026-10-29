import { describe, expect, it } from 'vitest'
import { documentSchema, factionSchema, intrigueSchema, itemSchema, locationSchema, timelineEventSchema, updateCharacterSchema } from '~/server/utils/schemas'

describe('intrigueSchema (US-015)', () => {
  it('ignore « prête à envoyer », qui n’a pas d’effet sur une intrigue', () => {
    const parsed = intrigueSchema.parse({ name: 'Le complot', gameId: 'jeu', readyToSend: true })
    expect(parsed).not.toHaveProperty('readyToSend')
    expect(parsed.name).toBe('Le complot')
  })
})

describe('itemSchema : quantité (US-014)', () => {
  const item = { name: 'Dague', gameId: 'jeu' }

  it.each([1, 3, '2'])('accepte %s', (quantity) => {
    expect(itemSchema.parse({ ...item, quantity }).quantity).toBe(Number(quantity))
  })

  it.each([0, -1, 1.5])('refuse %s', (quantity) => {
    expect(itemSchema.safeParse({ ...item, quantity }).success).toBe(false)
  })

  it('laisse la quantité absente quand la requête n’en porte pas', () => {
    expect(itemSchema.parse(item).quantity).toBeUndefined()
  })
})

describe('contenu : plus de champ « archivé » par élément (US-013, ADR-0027)', () => {
  it.each([
    ['updateCharacterSchema', updateCharacterSchema, { name: 'Ada' }],
    ['factionSchema', factionSchema, { name: 'Guilde', gameId: 'jeu' }],
    ['intrigueSchema', intrigueSchema, { name: 'Complot', gameId: 'jeu' }],
    ['locationSchema', locationSchema, { name: 'Château', gameId: 'jeu' }],
    ['itemSchema', itemSchema, { name: 'Dague', gameId: 'jeu' }],
    ['documentSchema', documentSchema, { title: 'Lettre', content: 'Texte', gameId: 'jeu' }],
    ['timelineEventSchema', timelineEventSchema, { name: 'Bal', day: 1, time: '20:00', gameId: 'jeu' }]
  ] as const)('%s ignore published', (_name, schema, body) => {
    expect(schema.parse({ ...body, published: false })).not.toHaveProperty('published')
  })
})
