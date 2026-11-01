import { describe, expect, it } from 'vitest'
import { answerFactor, castingAssistant, castingScore, hungarian, type CastingCharacter, type CastingPlayer } from '~/utils/castingAssistant'

const questions = [
  { id: 'style', label: 'Ton style', type: 'single' },
  { id: 'envies', label: 'Tes envies', type: 'multiple' },
  { id: 'niveau', label: 'Ton expérience', type: 'scale' }
]
const character = (id: string, extra: Partial<CastingCharacter> = {}): CastingCharacter => ({ id, name: id, factions: [], intrigues: [], relations: [], ...extra })
const player = (id: string, extra: Partial<CastingPlayer> = {}): CastingPlayer => ({ id, name: id, answers: {}, refusedTypes: [], notWithIds: [], ...extra })
const link = (questionId: string, option: string, kind: string, id: string) => ({ questionId, option, target: { kind, id, name: id } })

describe('note d’un joueur pour un personnage (US-101)', () => {
  it('compte 1 pour le personnage, ½ pour sa faction ou son intrigue, et l’échelle à proportion', () => {
    const iseult = character('Iseult', { factions: [{ id: 'loups', name: 'Loups' }], intrigues: [{ id: 'trone', name: 'Trône' }] })
    const camille = player('Camille', { answers: { style: 'Intrigue', envies: ['Romance', 'Mystère'], niveau: 4 } })
    const result = castingScore(camille, iseult, questions, [
      link('style', 'Intrigue', 'character', 'Iseult'),
      link('envies', 'Romance', 'faction', 'loups'),
      link('envies', 'Mystère', 'intrigue', 'trone'),
      link('envies', 'Trahison', 'character', 'Iseult'),
      link('niveau', '', 'character', 'Iseult'),
      link('style', 'Intrigue', 'character', 'Autre')
    ])
    expect(result.score).toBeCloseTo(1 + 0.5 + 0.5 + 0.75)
    expect(result.components.map((component) => component.label)).toEqual([
      '« Ton style » : Intrigue → Iseult',
      '« Tes envies » : Romance → faction loups',
      '« Tes envies » : Mystère → intrigue trone',
      '« Ton expérience » : 4/5 → Iseult'
    ])
  })

  it('une échelle à 1 ou sans réponse ne compte pas', () => {
    expect(answerFactor(questions[2]!, '', 1)).toBe(0)
    expect(answerFactor(questions[2]!, '', undefined)).toBe(0)
    expect(answerFactor(questions[2]!, '', 5)).toBe(1)
  })
})

describe('proposition de répartition (US-102)', () => {
  it('cherche la meilleure note totale, pas le premier choix de chacun', () => {
    expect(hungarian([[1, 2], [1, 10]])).toEqual([1, 0])
    // A préfère X (1 contre ½), mais B n'a de note que pour X : le total est meilleur avec A sur Y
    const result = castingAssistant({
      players: [player('A', { answers: { style: 'x', envies: ['y'] } }), player('B', { answers: { style: 'x' } })],
      characters: [character('X'), character('Y', { factions: [{ id: 'f', name: 'f' }] })],
      questions,
      links: [link('style', 'x', 'character', 'X'), link('envies', 'y', 'faction', 'f')],
      locked: new Map()
    })
    expect(result.proposal.map((line) => [line.characterId, line.playerId])).toEqual([['X', 'B'], ['Y', 'A']])
  })

  it('n’attribue jamais une relation refusée, et l’explique', () => {
    const result = castingAssistant({
      players: [player('A', { refusedTypes: ['romance'] }), player('B', { refusedTypes: ['none'] })],
      characters: [character('X', { relations: [{ otherId: 'Z', otherName: 'Bran', type: 'romance' }] }), character('Y')],
      questions,
      links: [],
      locked: new Map()
    })
    expect(result.pairs.A!.find((pair) => pair.characterId === 'X')!.blocks).toEqual(['Relation refusée : Romance, avec Bran'])
    expect(result.pairs.B!.every((pair) => pair.blocks.length === 0)).toBe(true)
    expect(result.proposal.find((line) => line.characterId === 'X')!.playerId).toBe('B')
  })

  it('garde les lignes verrouillées, y compris vides, et ne redonne rien à leur joueur', () => {
    const result = castingAssistant({
      players: [player('A'), player('B'), player('C')],
      characters: [character('X'), character('Y'), character('Z')],
      questions,
      links: [],
      locked: new Map([['X', 'A'], ['Y', null]])
    })
    expect(result.proposal.map((line) => [line.characterId, line.playerId, line.locked])).toEqual([['X', 'A', true], ['Y', null, true], ['Z', expect.any(String), false]])
    expect(result.proposal[2]!.playerId).not.toBe('A')
    expect(result.unplaced).toHaveLength(1)
  })

  it('ne met pas deux personnes brouillées sur des personnages en relation directe', () => {
    const relatedX = { otherId: 'Y', otherName: 'Y', type: 'family' }
    const relatedY = { otherId: 'X', otherName: 'X', type: 'family' }
    const characters = [character('X', { relations: [relatedX] }), character('Y', { relations: [relatedY] }), character('Z')]
    // A et B préfèrent X et Y, mais A ne veut pas jouer avec B
    const result = castingAssistant({
      players: [player('A', { answers: { style: 'x' }, notWithIds: ['B'] }), player('B', { answers: { envies: ['y'] } }), player('C')],
      characters,
      questions,
      links: [link('style', 'x', 'character', 'X'), link('envies', 'y', 'character', 'Y')],
      locked: new Map()
    })
    const holder = new Map(result.proposal.map((line) => [line.characterId, line.playerId]))
    expect([holder.get('X'), holder.get('Y')]).not.toEqual(['A', 'B'])
    expect(new Set(holder.values()).size).toBe(3)

    // Face à une ligne verrouillée, l'interdit est affiché sur la paire
    const locked = castingAssistant({ players: [player('A', { notWithIds: ['B'] }), player('B')], characters, questions, links: [], locked: new Map([['Y', 'B']]) })
    expect(locked.pairs.A!.find((pair) => pair.characterId === 'X')!.blocks[0]).toContain('Relation directe avec Y, joué par B')
    expect(locked.proposal.find((line) => line.characterId === 'X')!.playerId).toBeNull()
  })

  it('n’échange pas deux personnes brouillées entre elles : sans autre place, l’une reste sans personnage', () => {
    const characters = [character('X', { relations: [{ otherId: 'Y', otherName: 'Y', type: 'other' }] }), character('Y', { relations: [{ otherId: 'X', otherName: 'X', type: 'other' }] })]
    const result = castingAssistant({ players: [player('A', { notWithIds: ['C'] }), player('C')], characters, questions, links: [], locked: new Map() })
    expect(result.proposal.filter((line) => line.playerId)).toHaveLength(1)
    expect(result.unplaced).toHaveLength(1)
  })

  it('signale un conflit entre deux lignes verrouillées sans le défaire', () => {
    const characters = [character('X', { relations: [{ otherId: 'Y', otherName: 'Y', type: 'other' }] }), character('Y', { relations: [{ otherId: 'X', otherName: 'X', type: 'other' }] })]
    const result = castingAssistant({ players: [player('A'), player('B', { notWithIds: ['A'] })], characters, questions, links: [], locked: new Map([['X', 'A'], ['Y', 'B']]) })
    expect(result.lockedConflicts).toHaveLength(1)
    expect(result.proposal.map((line) => line.playerId)).toEqual(['A', 'B'])
  })
})
