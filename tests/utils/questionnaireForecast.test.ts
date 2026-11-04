// EPIC-041 : prévision du questionnaire (US-142, US-143, SPEC-016, R5 à R10)
import { describe, expect, it } from 'vitest'
import type { CastingLink } from '~/utils/castingAssistant'
import { answerProbabilities, maximalInformation, prepareQuestion, runForecast, simulateRegistrations, type ForecastInput, type OptionExpectation } from '~/utils/questionnaireForecast'
import { describeForecast, forecastScope } from '~/utils/questionnaireForecastText'
import { noteOf, type QualityCharacter, type QualityQuestion } from '~/utils/questionnaireQuality'
import { quantile, shannonEntropy } from '~/utils/statistics'

const question = (id: string, type: QualityQuestion['type'], options: string[] = []): QualityQuestion => ({ id, label: `Question ${id}`, type, options })
const toCharacter = (questionId: string, option: string, id: string): CastingLink => ({ questionId, option, target: { kind: 'character', id, name: id } })
const toFaction = (questionId: string, option: string, id: string): CastingLink => ({ questionId, option, target: { kind: 'faction', id, name: id } })
const character = (id: string, factions: string[] = []): QualityCharacter => ({ id, name: id, factions: factions.map((faction) => ({ id: faction, name: faction })), intrigues: [] })
const characters = (count: number) => Array.from({ length: count }, (_, index) => character(`p${index}`))
const share = (questionId: string, option: string, value: number): OptionExpectation => ({ questionId, option, share: value })
const input = (partial: Partial<ForecastInput>): ForecastInput => ({ questions: [], links: [], characters: [], expectations: [], ...partial })

describe('statistiques de la prévision', () => {
  it('calcule l’entropie en bits et les quantiles par interpolation', () => {
    expect(shannonEntropy([0.5, 0.5])).toBe(1)
    expect(shannonEntropy([1, 0])).toBe(0)
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5)
    expect(quantile([1, 2, 3, 4], 1)).toBe(4)
    expect(quantile([7], 0.975)).toBe(7)
  })
})

describe('proportions attendues (R6)', () => {
  const single = question('q', 'single', ['A', 'B', 'C', 'D'])

  it('donne la même chance à chaque réponse sans parts, et une fois sur deux à une option à cocher', () => {
    expect(answerProbabilities(single, [])).toEqual([0.25, 0.25, 0.25, 0.25])
    expect(answerProbabilities(question('e', 'scale'), [])).toEqual([0.2, 0.2, 0.2, 0.2, 0.2])
    expect(answerProbabilities(question('m', 'multiple', ['A', 'B']), [])).toEqual([0.5, 0.5])
  })

  it('ramène les poids à une somme de 1, une option vide comptant pour 0', () => {
    expect(answerProbabilities(single, [share('q', 'A', 0.5), share('q', 'B', 0.125)])).toEqual([0.8, 0.2, 0, 0])
  })

  it('tire chaque option à cocher selon sa part, une option vide comptant pour 0', () => {
    expect(answerProbabilities(question('m', 'multiple', ['A', 'B']), [share('m', 'A', 0.9)])).toEqual([0.9, 0])
  })

  it('compte une fois deux options de même texte', () => {
    const doubled = question('q', 'single', ['A', 'A', 'B'])
    expect(answerProbabilities(doubled, [share('q', 'A', 0.5), share('q', 'B', 0.5)])).toEqual([0.5, 0.5])
    expect(answerProbabilities(doubled, [])).toEqual([0.5, 0.5])
    const information = maximalInformation(input({
      questions: [question('m', 'multiple', ['X', 'X'])],
      links: [toCharacter('m', 'X', 'p0')],
      characters: characters(2)
    }))
    expect(information).toMatchObject({ profiles: 2, bits: 1 })
    const { demand } = simulateRegistrations(input({
      questions: [doubled],
      links: [toCharacter('q', 'B', 'p0')],
      characters: characters(1),
      expectations: [share('q', 'A', 0), share('q', 'B', 1)]
    }), 5)
    expect(demand).toEqual([{ kind: 'rarelyWanted', character: { id: 'p0', name: 'p0' }, median: 1, share: 1 }])
  })

  it('ignore les parts d’une option disparue, et une question laissée sans part positive revient à l’égalité', () => {
    const left = question('q', 'single', ['A', 'B'])
    expect(answerProbabilities(left, [share('q', 'Disparue', 1)])).toEqual([0.5, 0.5])
    expect(answerProbabilities(left, [share('q', 'A', 0), share('q', 'B', 0)])).toEqual([0.5, 0.5])
  })
})

describe('information maximale (R5)', () => {
  it('confond les options de mêmes liens, et compte une échelle et chaque option cochable reliée', () => {
    const information = maximalInformation(input({
      questions: [question('u', 'single', ['A', 'B', 'C', 'D']), question('e', 'scale'), question('m', 'multiple', ['X', 'Y', 'Z']), question('libre', 'text'), question('sans', 'single', ['A', 'B'])],
      links: [
        // A et B ont les mêmes liens, dans un ordre différent ; C et D n'en ont aucun : deux groupes
        toCharacter('u', 'A', 'p0'), toFaction('u', 'A', 'f'), toFaction('u', 'B', 'f'), toCharacter('u', 'B', 'p0'),
        toCharacter('e', '', 'p1'),
        toCharacter('m', 'X', 'p0'), toCharacter('m', 'Y', 'p1')
      ],
      characters: characters(40)
    }))
    expect(information.questions.map(({ id }) => id)).toEqual(['u', 'e', 'm'])
    expect(information.questions.map(({ bits }) => bits)).toEqual([1, Math.log2(5), 2])
    expect(information.profiles).toBe(40)
    expect(information.bits).toBeCloseTo(Math.log2(40))
    expect(information.level).toBe('good')
  })

  it('est à revoir sous le nombre de personnages, pas à ce nombre', () => {
    const form = {
      questions: [question('a', 'single', ['A', 'B', 'C', 'D']), question('b', 'single', ['A', 'B', 'C'])],
      links: [
        ...['A', 'B', 'C', 'D'].map((option) => toCharacter('a', option, `p${option}`)),
        ...['A', 'B', 'C'].map((option) => toCharacter('b', option, `q${option}`))
      ]
    }
    expect(maximalInformation(input({ ...form, characters: characters(12) }))).toMatchObject({ level: 'good', profiles: 12 })
    const short = maximalInformation(input({ ...form, characters: characters(16) }))
    expect(short).toMatchObject({ level: 'review', profiles: 12, requiredBits: 4 })
  })

  it('donne l’information attendue avec les parts, par groupe d’options ou par option cochable reliée', () => {
    const { questions } = maximalInformation(input({
      questions: [question('u', 'single', ['A', 'B', 'C']), question('m', 'multiple', ['X', 'Y', 'Z']), question('e', 'scale')],
      links: [toCharacter('u', 'A', 'p0'), toCharacter('u', 'B', 'p0'), toCharacter('u', 'C', 'p1'), toCharacter('m', 'X', 'p0'), toCharacter('m', 'Y', 'p1'), toCharacter('e', '', 'p0')],
      characters: characters(2),
      expectations: [share('u', 'A', 0.5), share('u', 'B', 0.25), share('u', 'C', 0.25), share('m', 'X', 0.5), share('m', 'Z', 0.9)]
    }))
    expect(questions[0]!.expected).toBeCloseTo(shannonEntropy([0.75, 0.25]))
    // X : un bit ; Y, vide, compte pour 0 ; Z n'est pas reliée
    expect(questions[1]!.expected).toBeCloseTo(1)
    expect(questions[2]!.expected).toBeNull()
  })
})

describe('simulation (R7 à R10)', () => {
  const fourCharacters = [character('a', ['f']), character('b', ['f']), character('c'), character('d')]
  const form = {
    questions: [question('u', 'single', ['A', 'B']), question('e', 'scale'), question('m', 'multiple', ['X', 'Y'])],
    links: [toCharacter('u', 'A', 'a'), toFaction('u', 'B', 'f'), toCharacter('e', '', 'c'), toCharacter('m', 'X', 'd'), toFaction('m', 'Y', 'f')]
  }

  it('additionne des points égaux à la note de l’assistant', () => {
    const prepared = form.questions.map((entry) => prepareQuestion(entry, form.links, fourCharacters, []))
    const [single, scale, multiple] = prepared
    const answers = { u: 'B', e: 3, m: ['X', 'Y'] }
    const expected = fourCharacters.map((entry) => noteOf({ ...entry, relations: [] }, answers, form.questions, form.links))
    const summed = fourCharacters.map((_, index) => single!.points[1]![index]! + scale!.points[2]![index]! + multiple!.points[0]![index]! + multiple!.points[1]![index]!)
    expect(summed).toEqual(expected)
    expect(expected).toEqual([1, 1, 0.5, 1])
  })

  it('applique les seuils à la médiane : tout le monde sur la même option', () => {
    const { note, ties, demand, people, runs } = simulateRegistrations(input({
      questions: [question('u', 'single', ['A', 'B'])],
      links: [toCharacter('u', 'A', 'p0'), toCharacter('u', 'B', 'p1')],
      characters: characters(4),
      expectations: [share('u', 'A', 1), share('u', 'B', 0)]
    }), 50)
    expect({ people, runs }).toEqual({ people: 4, runs: 50 })
    // Une seule des quatre personnes obtient p0, les trois autres n'ont aucun point dans le rôle restant
    expect(note).toEqual({ level: 'review', median: 0.25, lower: 0.25, upper: 0.25 })
    expect(ties).toEqual({ level: 'good', median: 0, lower: 0, upper: 0 })
    // p1, relié, n'est jamais choisi ; p0 est le premier de tous ; p2 et p3, sans lien, ont déjà leur repère
    expect(demand).toEqual([
      { kind: 'overWanted', character: { id: 'p0', name: 'p0' }, median: 4, share: 1 },
      { kind: 'rarelyWanted', character: { id: 'p1', name: 'p1' }, median: 0, share: 1 }
    ])
  })

  it('compte à égalité les personnes sans aucun point, et n’a alors pas de note', () => {
    const { note, ties } = simulateRegistrations(input({
      questions: [question('u', 'single', ['A', 'B'])],
      links: [toCharacter('u', 'A', 'autre')],
      characters: characters(3),
      expectations: [share('u', 'B', 1)]
    }), 20)
    expect(note).toBeNull()
    expect(ties).toEqual({ level: 'review', median: 1, lower: 1, upper: 1 })
  })

  it('juge bon un questionnaire qui départage, avec une fourchette autour de la médiane', () => {
    const count = 8
    const list = characters(count)
    const questions = Array.from({ length: 6 }, (_, index) => question(`q${index}`, 'single', ['A', 'B', 'C', 'D']))
    const links = questions.flatMap(({ id }, q) => ['A', 'B', 'C', 'D'].map((option, o) => toCharacter(id, option, `p${(q * 3 + o * 2) % count}`)))
    const { note, ties } = simulateRegistrations(input({ questions, links, characters: list }), 200)
    expect(note!.level).toBe('good')
    expect(note!.lower).toBeLessThanOrEqual(note!.median)
    expect(note!.upper).toBeGreaterThanOrEqual(note!.median)
    expect(ties.lower).toBeLessThanOrEqual(ties.median)
  })

  it('redonne le même résultat, quel que soit l’ordre lu en base, et malgré un libellé ou un nom corrigé', () => {
    const base = input({ ...form, characters: fourCharacters })
    const first = runForecast(base, 100)
    expect(runForecast(base, 100)).toEqual(first)
    const reordered = runForecast(input({ questions: form.questions, links: [...form.links].reverse(), characters: [...fourCharacters].reverse() }), 100)
    expect(reordered.simulation).toEqual(first.simulation)
    const relabelled = runForecast(input({
      questions: form.questions.map((entry) => ({ ...entry, label: `${entry.label} corrigée` })),
      links: form.links,
      characters: fourCharacters
    }), 100)
    expect(relabelled.simulation).toEqual(first.simulation)
  })

  it('change avec les proportions', () => {
    const base = input({ ...form, characters: fourCharacters })
    const other = input({ ...base, expectations: [share('u', 'A', 0.9), share('u', 'B', 0.1)] })
    expect(runForecast(other, 100).simulation).not.toEqual(runForecast(base, 100).simulation)
  })

  it('prend pour niveau le plus grave de la prévision, et compte les questions avec des parts', () => {
    const forecast = runForecast(input({
      questions: [question('u', 'single', ['A', 'B']), question('v', 'single', ['A', 'B'])],
      links: [toCharacter('u', 'A', 'p0'), toCharacter('v', 'A', 'p1')],
      characters: characters(4),
      expectations: [share('u', 'A', 1)]
    }), 20)
    expect(forecast.information.level).toBe('good')
    expect(forecast.level).toBe('review')
    expect(forecast).toMatchObject({ linkedCount: 2, withShares: 1 })
  })
})

describe('phrases de la prévision', () => {
  const links = [...['A', 'B', 'C', 'D'].map((option, index) => toCharacter('a', option, `p${index}`)), ...['A', 'B', 'C'].map((option, index) => toCharacter('b', option, `p${index + 4}`))]
  const questions = [question('a', 'single', ['A', 'B', 'C', 'D']), question('b', 'single', ['A', 'B', 'C'])]

  it('dit combien de profils les questions distinguent, et le détail par question', () => {
    const [information] = describeForecast(runForecast(input({ questions, links, characters: characters(16), expectations: [share('a', 'A', 1), share('a', 'B', 1)] }), 10))
    expect(information).toMatchObject({ level: 'review', sentence: 'Vos questions distinguent au plus 12 profils de réponses, pour 16 personnages.' })
    expect(information!.detail).toContain('il en faut au moins 4 bits')
    expect(information!.detail).toContain('« Question a » : 2 bits, 1 bit attendu avec vos proportions')
    expect(information!.detail).toContain('« Question b » : 1,585 bit')
    expect(information!.detail).toContain('Condition nécessaire, pas suffisante')
  })

  it('dit qu’un questionnaire suffit, sans chiffre illisible', () => {
    const many = Array.from({ length: 40 }, (_, index) => question(`m${index}`, 'multiple', ['X']))
    const [information] = describeForecast(runForecast(input({ questions: many, links: many.map(({ id }) => toCharacter(id, 'X', 'p0')), characters: characters(2) }), 5))
    expect(information).toMatchObject({ level: 'good', sentence: 'Vos questions distinguent plus d’un milliard de profils de réponses, pour 2 personnages : c’est assez pour les départager.', todo: '' })
  })

  it('accorde la phrase à un seul profil et un seul personnage', () => {
    const [information] = describeForecast(runForecast(input({
      questions: [question('u', 'single', ['A', 'B'])],
      links: [toCharacter('u', 'A', 'p0'), toCharacter('u', 'B', 'p0')],
      characters: characters(1)
    }), 5))
    expect(information!.sentence).toBe('Vos questions distinguent au plus 1 profil de réponses, pour 1 personnage.')
  })

  it('ne dit 10 simulations sur 10 que si c’est le cas de toutes', () => {
    const forecast = runForecast(input({
      questions: [question('u', 'single', ['A', 'B'])],
      links: [toCharacter('u', 'A', 'p0'), toCharacter('u', 'B', 'p1')],
      characters: characters(4),
      expectations: [share('u', 'A', 1), share('u', 'B', 0)]
    }), 5)
    const sentences = (value: number) => describeForecast({
      ...forecast,
      simulation: { ...forecast.simulation, demand: forecast.simulation.demand.map((entry) => ({ ...entry, share: value })) }
    }).at(-1)!.sentence
    expect(sentences(1)).toBe('p1 serait peu demandé dans 10 simulations sur 10.')
    expect(sentences(0.96)).toBe('p1 serait peu demandé dans 9 simulations sur 10.')
    expect(sentences(0.68)).toBe('p1 serait peu demandé dans 7 simulations sur 10.')
  })

  it('donne médiane et fourchette, et les personnages à surveiller en simulations sur 10', () => {
    const items = describeForecast(runForecast(input({
      questions: [question('u', 'single', ['A', 'B'])],
      links: [toCharacter('u', 'A', 'p0'), toCharacter('u', 'B', 'p1')],
      characters: characters(4),
      expectations: [share('u', 'A', 1), share('u', 'B', 0)]
    }), 20))
    expect(items.map(({ sentence }) => sentence)).toEqual([
      'Vos questions distinguent au plus 2 profils de réponses, pour 4 personnages.',
      'Pour une inscription typique, chaque personne qui reçoit un rôle obtiendrait en moyenne 25 % de sa meilleure note possible (de 25 à 25 % selon les simulations).',
      'Pour une inscription typique, 0 % des personnes auraient plusieurs personnages à égalité en tête (de 0 à 0 % selon les simulations).',
      'p0 serait disputé dans 10 simulations sur 10.',
      'p1 serait peu demandé dans 10 simulations sur 10.'
    ])
  })

  it('rappelle les hypothèses : optimiste sans proportions, ou pour les questions qui n’en ont pas', () => {
    const scope = (expectations: OptionExpectation[]) => forecastScope(runForecast(input({ questions, links, characters: characters(2), expectations }), 5))
    expect(scope([])).toContain('Chaque réponse a la même chance : de vraies réponses ne se répartissent jamais également, cette prévision est donc optimiste.')
    expect(scope([share('a', 'A', 1)])).toContain('1 question reliée sur 2 suit vos proportions')
    expect(scope([share('a', 'A', 1), share('b', 'A', 1)])).toContain('Les réponses suivent vos proportions.')
    expect(scope([])).toMatch(/2 personnes fictives, autant que de personnages, 1\s000 fois de suite/)
  })
})
