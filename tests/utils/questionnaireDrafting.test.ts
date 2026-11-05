import { describe, expect, it } from 'vitest'
import { draftingReview, lengthLimit, negationCount, wordCount, type DraftingQuestion } from '../../utils/questionnaireDrafting'
import { describeDraftingFlag, draftingFlagCount } from '../../utils/questionnaireDraftingText'

const question = (label: string, options: string[] = [], type: DraftingQuestion['type'] = 'single'): DraftingQuestion => ({ id: label, label, type, options })
const flagsOf = (...args: Parameters<typeof question>) => draftingReview([question(...args)]).questions[0]?.flags ?? []

// US-144 : règles de relecture (SPEC-016, R11, ADR-0062)
describe('double sens', () => {
  it('repère « et » et « ou » dans le libellé et les options, sans doublon', () => {
    expect(flagsOf('Aimes-tu l’action et le mystère, et la romance ?', ['Oui ou non', 'Peut-être'])).toEqual([
      { rule: 'doubleBarreled', places: [{ word: 'et', option: null }, { word: 'ou', option: 'Oui ou non' }] }
    ])
  })

  it('ne confond pas « où » avec « ou », ni un mot qui les contient', () => {
    expect(flagsOf('Où joues-tu ?', ['Etage', 'Toutes', 'Ouest'])).toEqual([])
  })

  it('lit « et/ou », et un « où » écrit en lettres décomposées', () => {
    expect(flagsOf('Combat et/ou intrigue ?')[0]).toMatchObject({ rule: 'doubleBarreled', places: [{ word: 'et' }, { word: 'ou' }] })
    expect(flagsOf('Où joues-tu ?')).toEqual([])
  })
})

describe('double négation', () => {
  it('compte « ne… pas » pour une, et « pas » seul en registre familier', () => {
    expect(negationCount('Tu ne joues pas ?')).toBe(1)
    expect(negationCount('Tu n’aimes pas le combat ?')).toBe(1)
    expect(negationCount('Tu n\'aimes pas le combat ?')).toBe(1)
    expect(negationCount('T’aimes pas le combat ?')).toBe(1)
    expect(negationCount('Tu joues sans arme ?')).toBe(1)
  })

  it('signale à partir de deux négations', () => {
    expect(flagsOf('Ne refuses-tu pas de jouer sans arme ?')).toContainEqual({ rule: 'doubleNegative', negations: 2 })
    expect(flagsOf('Ne joues-tu pas ?')).toEqual([])
  })

  it('ne compte ni « n° » ni « pas à pas »', () => {
    expect(negationCount('Question n°2 : ne viens-tu pas ?')).toBe(1)
    expect(negationCount('N° 2 : avances-tu pas à pas, ou pas-à-pas ?')).toBe(0)
    expect(negationCount('N’avances-tu pas ?')).toBe(1)
  })

  it('juge « pas » phrase par phrase, et le libellé seulement', () => {
    expect(negationCount('Tu ne joues pas. Pas de combat ?')).toBe(2)
    expect(negationCount('Tu ne joues pas… Pas de combat ?')).toBe(2)
    expect(flagsOf('Ton style ?', ['Ne jamais fuir sans raison', 'Autre'])).toEqual([])
  })
})

describe('format « d’accord »', () => {
  it('le repère avec les deux apostrophes et sans tenir compte de la casse', () => {
    expect(flagsOf('Es-tu d’accord avec ceci ?')[0]).toMatchObject({ rule: 'agreeFormat', places: [{ option: null }] })
    expect(flagsOf('Ceci te convient ?', ['D\'ACCORD', 'Autre'])[0]).toMatchObject({ rule: 'agreeFormat', places: [{ option: 'D\'ACCORD' }] })
  })
})

describe('quantifieur vague', () => {
  it('le repère sans tenir compte des accents', () => {
    expect(flagsOf('Joues-tu souvent ?')[0]).toMatchObject({ rule: 'vagueQuantifier', places: [{ word: 'souvent' }] })
    expect(flagsOf('Tes sorties ?', ['Régulièrement', 'Frequemment'])[0]).toMatchObject({ places: [{ word: 'régulièrement', option: 'Régulièrement' }, { word: 'frequemment', option: 'Frequemment' }] })
  })

  it('laisse « Peu importe », mais pas « peu »', () => {
    expect(flagsOf('Ton rôle ?', ['Peu importe', 'Héros'])).toEqual([])
    expect(flagsOf('Ton rôle ?', ['Peu présent', 'Héros'])[0]).toMatchObject({ rule: 'vagueQuantifier' })
  })
})

describe('longueur', () => {
  it('compte les mots aux espaces et à l’apostrophe, sans ponctuation isolée', () => {
    expect(wordCount('L’ami d\'Aldric est-il prêt ?')).toBe(6)
  })

  it('applique la règle de Tukey', () => {
    // Q1 = 5, Q3 = 13,75, limite = 26,875
    expect(lengthLimit([5, 5, 5, 40])).toBeCloseTo(26.875)
    expect(lengthLimit([])).toBeNull()
  })

  it('ne s’applique pas si l’écart interquartile est nul', () => {
    expect(lengthLimit([5, 5, 5, 5, 5, 40])).toBeNull()
    expect(lengthLimit([7])).toBeNull()
  })

  it('signale la question aberrante et donne les nombres de mots en détail', () => {
    const long = Array.from({ length: 40 }, () => 'mot').join(' ')
    const review = draftingReview([question('Un deux trois quatre cinq'), question('Six sept huit neuf dix'), question('Onze douze treize quatorze quinze'), question(long, [], 'text')])
    expect(review.questions).toEqual([{ questionId: long, label: long, flags: [{ rule: 'length', words: 40 }] }])
    const { sentence, detail, level } = describeDraftingFlag(review.questions[0]!.flags[0]!, review.wordCounts)
    expect(level).toBe('watch')
    expect(sentence).toContain('40 mots')
    expect(detail).toContain('« Un deux trois quatre cinq » : 5 mots')
    expect(detail).toContain('Tukey')
  })
})

describe('relecture du formulaire', () => {
  it('une question à texte libre n’a que le repère de longueur', () => {
    expect(flagsOf('Souvent, ne viens-tu pas sans ami ou d’accord ?', [], 'text')).toEqual([])
  })

  it('une échelle est relue sur son libellé', () => {
    expect(flagsOf('Envie de combat et de romance ?', [], 'scale')).toEqual([{ rule: 'doubleBarreled', places: [{ word: 'et', option: null }] }])
  })

  it('garde l’ordre du formulaire, ne rend que les questions signalées et groupe leurs défauts', () => {
    const review = draftingReview([question('Joues-tu souvent et longtemps ?'), question('Ton style ?'), question('Combat ou intrigue ?')])
    expect(review.questions.map(({ label, flags }) => [label, flags.map(({ rule }) => rule)])).toEqual([
      ['Joues-tu souvent et longtemps ?', ['doubleBarreled', 'vagueQuantifier']],
      ['Combat ou intrigue ?', ['doubleBarreled']]
    ])
    expect(draftingFlagCount(review)).toBe(3)
    expect(review.wordCounts).toHaveLength(3)
  })

  it('chaque signalement dit la règle, ce qu’il faut vérifier et sa référence', () => {
    const [flag] = flagsOf('Combat ou intrigue ?', ['Oui et non', 'Autre'])
    expect(describeDraftingFlag(flag!, [])).toEqual({
      level: 'watch',
      sentence: 'Question à double sens possible : « ou » dans le libellé, « et » dans l’option « Oui et non ».',
      todo: 'Vérifiez qu’elle ne porte que sur une chose à la fois ; sinon, scindez-la.',
      detail: 'Bradburn, Sudman et Wansink (2004), Asking Questions.'
    })
  })
})
