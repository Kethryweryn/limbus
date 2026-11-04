import { describe, expect, it } from 'vitest'
import type { QualityCharacter } from '~/utils/questionnaireQuality'
import { trialRanking } from '~/utils/questionnaireTrial'

const questions = [
  { id: 'style', label: 'Ton style', type: 'single' },
  { id: 'envies', label: 'Tes envies', type: 'multiple' },
  { id: 'niveau', label: 'Ton expérience', type: 'scale' }
]
const character = (name: string, extra: Partial<QualityCharacter> = {}): QualityCharacter => ({ id: name, name, factions: [], intrigues: [], ...extra })
const link = (questionId: string, option: string, kind: string, id: string) => ({ questionId, option, target: { kind, id, name: id } })

describe('classement de l’essai (US-135)', () => {
  it('sans réponse, aucun personnage n’est rejoint', () => {
    expect(trialRanking([character('A'), character('B')], questions, [link('style', 'Intrigue', 'character', 'A')], {})).toEqual({
      ranked: [],
      unreached: [{ id: 'A', name: 'A' }, { id: 'B', name: 'B' }]
    })
  })

  it('classe par note, avec le détail, et met à part le personnage non rejoint', () => {
    const links = [link('style', 'Intrigue', 'character', 'B'), link('niveau', '', 'character', 'A')]
    const { ranked, unreached } = trialRanking([character('A'), character('B'), character('C')], questions, links, { style: 'Intrigue', niveau: 3 })
    expect(ranked.map(({ name, score, tied }) => ({ name, score, tied }))).toEqual([
      { name: 'B', score: 1, tied: false },
      { name: 'A', score: 0.5, tied: false }
    ])
    expect(ranked[0]?.components).toEqual([{ label: '« Ton style » : Intrigue → B', points: 1 }])
    expect(ranked[1]?.components).toEqual([{ label: '« Ton expérience » : 3/5 → A', points: 0.5 }])
    expect(unreached).toEqual([{ id: 'C', name: 'C' }])
  })

  it('compte ½ point par la faction, et signale les ex æquo', () => {
    const loups = { id: 'loups', name: 'Loups' }
    const links = [link('envies', 'Romance', 'faction', 'loups'), link('envies', 'Trahison', 'character', 'C')]
    const characters = [character('A', { factions: [loups] }), character('B', { factions: [loups] }), character('C')]
    const { ranked, unreached } = trialRanking(characters, questions, links, { envies: ['Romance', 'Trahison'] })
    expect(ranked.map(({ name, score, tied }) => ({ name, score, tied }))).toEqual([
      { name: 'C', score: 1, tied: false },
      { name: 'A', score: 0.5, tied: true },
      { name: 'B', score: 0.5, tied: true }
    ])
    expect(unreached).toEqual([])
  })

  it('ignore le lien d’une question absente de l’essai', () => {
    const { ranked } = trialRanking([character('A')], questions, [link('retiree', 'Oui', 'character', 'A')], { retiree: 'Oui' })
    expect(ranked).toEqual([])
  })
})
