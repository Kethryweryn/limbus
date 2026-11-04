import { describe, expect, it } from 'vitest'
import { cosineSimilarity, latestAnswersPerPerson, linkFindings, pointProfile, questionnaireFindings, type QualityCharacter, type QualityQuestion } from '~/utils/questionnaireQuality'

const questions: QualityQuestion[] = [
  { id: 'style', label: 'Ton style', type: 'single', options: ['Intrigue', 'Combat', 'Mystère'] },
  { id: 'envies', label: 'Tes envies', type: 'multiple', options: ['Romance', 'Trahison'] },
  { id: 'niveau', label: 'Ton expérience', type: 'scale', options: [] },
  { id: 'libre', label: 'Autre chose ?', type: 'text', options: [] }
]
const character = (name: string, extra: Partial<QualityCharacter> = {}): QualityCharacter => ({ id: name, name, factions: [], intrigues: [], ...extra })
const link = (questionId: string, option: string, kind: string, id: string) => ({ questionId, option, target: { kind, id, name: id } })
const kinds = (findings: ReturnType<typeof linkFindings>) => findings.map((finding) => finding.kind)

describe('profil de points (US-134)', () => {
  it('donne les points de chaque réponse possible, comme la note de l’assistant', () => {
    const iseult = character('Iseult', { factions: [{ id: 'loups', name: 'Loups' }] })
    const profile = pointProfile(iseult, questions, [
      link('style', 'Intrigue', 'character', 'Iseult'),
      link('envies', 'Romance', 'faction', 'loups'),
      link('niveau', '', 'character', 'Iseult')
    ])
    // Intrigue, Combat, Mystère, Romance, Trahison, échelle à 5/5 ; la question libre n'a pas de réponse possible
    expect(profile).toEqual([1, 0, 0, 0.5, 0, 1])
  })

  it('similarité cosinus : 1 pour des profils proportionnels, 0 sans réponse commune ou pour un profil nul', () => {
    expect(cosineSimilarity([1, 0.5, 0], [2, 1, 0])).toBeCloseTo(1)
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBe(0)
    expect(cosineSimilarity([0, 0], [1, 0])).toBe(0)
  })
})

describe('repères sur les liens (US-133)', () => {
  it('signale un personnage sans lien, à revoir, avant les autres repères', () => {
    const findings = linkFindings(questions, [link('style', 'Intrigue', 'character', 'Iseult')], [character('Iseult'), character('Bran')])
    expect(findings[0]).toEqual({ kind: 'characterWithoutLink', level: 'review', character: { id: 'Bran', name: 'Bran' } })
  })

  it('un lien par la faction ou l’intrigue suffit', () => {
    const bran = character('Bran', { intrigues: [{ id: 'trone', name: 'Trône' }] })
    const findings = linkFindings(questions, [link('niveau', '', 'intrigue', 'trone')], [bran])
    expect(kinds(findings)).not.toContain('characterWithoutLink')
  })

  it('signale une question sans lien et une option sans lien, à surveiller ; ignore le texte libre', () => {
    const findings = linkFindings(questions, [link('style', 'Intrigue', 'character', 'Iseult'), link('niveau', '', 'character', 'Iseult')], [character('Iseult')])
    expect(findings).toEqual([
      { kind: 'optionWithoutLink', level: 'watch', questionId: 'style', questionLabel: 'Ton style', option: 'Combat' },
      { kind: 'optionWithoutLink', level: 'watch', questionId: 'style', questionLabel: 'Ton style', option: 'Mystère' },
      { kind: 'questionWithoutLink', level: 'watch', questionId: 'envies', questionLabel: 'Tes envies' }
    ])
  })

  it('aucun repère quand chaque option désigne un rôle propre', () => {
    const findings = linkFindings(questions.slice(0, 2), [
      link('style', 'Intrigue', 'character', 'A'),
      link('style', 'Combat', 'character', 'B'),
      link('style', 'Mystère', 'character', 'C'),
      link('envies', 'Romance', 'character', 'A'),
      link('envies', 'Trahison', 'character', 'B')
    ], [character('A'), character('B'), character('C')])
    expect(findings).toEqual([])
  })
})

describe('personnages indistincts par les liens (US-134)', () => {
  const only = (findings: ReturnType<typeof linkFindings>) => findings.filter((finding) => finding.kind === 'indistinctCharacters')

  it('deux personnages de la même faction, reliés par elle seule, sont indistincts, sans réponse qui les sépare', () => {
    const loups = [{ id: 'loups', name: 'Loups' }]
    const [finding] = only(linkFindings(questions, [link('style', 'Intrigue', 'faction', 'loups')], [character('Aldric', { factions: loups }), character('Bertrand', { factions: loups })]))
    expect(finding).toMatchObject({ level: 'review', similarity: 1, threshold: 0.8, separating: null })
  })

  it('donne la réponse qui les sépare le plus, et celui qu’elle favorise', () => {
    // Profils (1, 1, 0, 0) et (1, 1, 0.5, 0) : cosinus 0,94
    const [finding] = only(linkFindings(questions.slice(0, 2), [
      link('style', 'Intrigue', 'character', 'Aldric'),
      link('style', 'Intrigue', 'character', 'Bertrand'),
      link('style', 'Combat', 'character', 'Aldric'),
      link('style', 'Combat', 'character', 'Bertrand'),
      link('style', 'Mystère', 'faction', 'loups')
    ], [character('Aldric'), character('Bertrand', { factions: [{ id: 'loups', name: 'Loups' }] })]))
    expect(finding).toMatchObject({ separating: { questionLabel: 'Ton style', option: 'Mystère', favors: { name: 'Bertrand' } } })
    expect(finding).toMatchObject({ similarity: expect.closeTo(2 / Math.sqrt(2 * 2.25)) })
  })

  it('compte l’échelle à 5/5, et ne signale rien sous le seuil de 0,80', () => {
    // Profils (1, 0, 1) et (1, 1, 0) sur Intrigue, Combat et l'échelle : cosinus 0,5
    const findings = linkFindings([questions[0]!, questions[2]!], [
      link('style', 'Intrigue', 'character', 'A'),
      link('style', 'Intrigue', 'character', 'B'),
      link('style', 'Combat', 'character', 'B'),
      link('niveau', '', 'character', 'A')
    ], [character('A'), character('B')])
    expect(only(findings)).toEqual([])
  })

  it('ne compare pas un personnage sans lien', () => {
    const findings = linkFindings(questions, [link('style', 'Intrigue', 'character', 'A')], [character('A'), character('B'), character('C')])
    expect(only(findings)).toEqual([])
  })
})

// Seulement les repères sur les réponses, sans ceux sur les liens
const LINK_KINDS = ['characterWithoutLink', 'questionWithoutLink', 'optionWithoutLink', 'indistinctCharacters']
const answerFindings = (...args: Parameters<typeof questionnaireFindings>) => {
  const { respondentCount, findings } = questionnaireFindings(...args)
  return { respondentCount, findings: findings.filter((finding) => !LINK_KINDS.includes(finding.kind)) }
}

// n réponses identiques
const times = (count: number, answers: Record<string, unknown>) => Array.from({ length: count }, () => answers)

describe('estimation générale (US-140, R13)', () => {
  const style: QualityQuestion = { id: 'style', label: 'Ton style', type: 'single', options: ['Intrigue', 'Combat', 'Mystère', 'Fête'] }
  const toCharacter = (option: string, id: string) => link('style', option, 'character', id)
  const estimateOf = (links: ReturnType<typeof link>[], characters: QualityCharacter[], people: Array<Record<string, unknown>>) =>
    questionnaireFindings([style], links, characters, people).estimate
  const roles = (count: number) => Array.from({ length: count }, (_, index) => character(`P${index}`))

  it('absente sans réponse ou sans personnage', () => {
    expect(estimateOf([toCharacter('Intrigue', 'A')], [character('A')], [])).toBeNull()
    expect(estimateOf([], [], [{ style: 'Intrigue' }])).toBeNull()
  })

  it('bon : chacun obtient sa meilleure note, sans ex æquo', () => {
    const estimate = estimateOf([toCharacter('Intrigue', 'A'), toCharacter('Combat', 'B')], [character('A'), character('B')], [{ style: 'Intrigue' }, { style: 'Combat' }])
    expect(estimate).toMatchObject({ level: 'good', withoutRole: 0, withoutPoints: 0, note: { level: 'good', value: 1, counted: 2, tooFewPeople: false }, ties: { level: 'good', count: 0, total: 2 } })
  })

  it('à surveiller entre 0,60 et 0,75', () => {
    const links = [toCharacter('Intrigue', 'P0'), toCharacter('Combat', 'P1'), toCharacter('Mystère', 'P2')]
    const estimate = estimateOf(links, roles(5), [...times(3, { style: 'Intrigue' }), { style: 'Combat' }, { style: 'Mystère' }])
    expect(estimate?.note).toMatchObject({ level: 'watch', value: 0.6 })
    expect(estimate?.level).toBe('watch')
  })

  it('à revoir quand la borne haute reste sous 0,60', () => {
    const estimate = estimateOf([toCharacter('Intrigue', 'P0')], roles(30), times(30, { style: 'Intrigue' }))
    expect(estimate?.note).toMatchObject({ level: 'review', counted: 30 })
    expect(estimate?.note?.upper).toBeLessThan(0.6)
    expect(estimate?.level).toBe('review')
  })

  it('à confirmer quand seule la valeur est sous 0,60', () => {
    const estimate = estimateOf([toCharacter('Intrigue', 'A')], [character('A'), character('B')], times(2, { style: 'Intrigue' }))
    expect(estimate?.note).toMatchObject({ level: 'unsure', value: 0.5, counted: 2, tooFewPeople: false })
  })

  it('à confirmer tant qu’il y a moins de personnes que de rôles, même avec une note parfaite', () => {
    const estimate = estimateOf([toCharacter('Intrigue', 'A')], [character('A'), character('B')], [{ style: 'Intrigue' }])
    expect(estimate?.note).toMatchObject({ level: 'unsure', value: 1, tooFewPeople: true })
  })

  it('ne compte que les personnes placées quand les rôles manquent', () => {
    const estimate = estimateOf([toCharacter('Intrigue', 'A')], [character('A')], times(4, { style: 'Intrigue' }))
    expect(estimate).toMatchObject({ withoutRole: 3, note: { level: 'good', value: 1, counted: 1 } })
  })

  it('ex æquo : à revoir si la borne basse dépasse 50 %, à confirmer sinon, bon jusqu’à une personne sur deux', () => {
    const both = [toCharacter('Intrigue', 'A'), toCharacter('Intrigue', 'B'), toCharacter('Combat', 'A')]
    const pair = [character('A'), character('B')]
    expect(estimateOf(both, pair, times(20, { style: 'Intrigue' }))?.ties).toMatchObject({ level: 'review', count: 20, total: 20, share: 1 })
    expect(estimateOf(both, pair, [...times(3, { style: 'Intrigue' }), { style: 'Combat' }])?.ties).toMatchObject({ level: 'unsure', count: 3, total: 4 })
    expect(estimateOf(both, pair, [{ style: 'Intrigue' }, { style: 'Combat' }])?.ties).toMatchObject({ level: 'good', share: 0.5 })
  })

  it('une personne sans aucun point sort de la note et compte comme ex æquo', () => {
    const links = [toCharacter('Intrigue', 'A'), toCharacter('Combat', 'B')]
    const estimate = estimateOf(links, [character('A'), character('B')], [{ style: 'Intrigue' }, { style: 'Mystère' }])
    expect(estimate).toMatchObject({ withoutPoints: 1, note: { counted: 1, value: 1 }, ties: { count: 1, total: 2 } })
  })

  it('sans personne comptée, seuls les ex æquo fixent le niveau ; un seul personnage n’a pas d’ex æquo', () => {
    const none = estimateOf([toCharacter('Intrigue', 'A')], [character('A')], [{ style: 'Combat' }])
    expect(none).toMatchObject({ level: 'good', note: null, withoutPoints: 1, ties: { count: 0 } })
  })

  it('le niveau d’ensemble est le plus grave des deux mesures', () => {
    const both = [toCharacter('Intrigue', 'A'), toCharacter('Intrigue', 'B')]
    expect(estimateOf(both, [character('A'), character('B')], times(20, { style: 'Intrigue' }))).toMatchObject({ level: 'review', note: { level: 'good' }, ties: { level: 'review' } })
  })

  it('trie les repères à revoir du plus bloquant au moins bloquant', () => {
    const a: QualityQuestion = { id: 'a', label: 'A', type: 'single', options: ['Oui', 'Non'] }
    const b: QualityQuestion = { id: 'b', label: 'B', type: 'single', options: ['Oui', 'Non'] }
    const c: QualityQuestion = { id: 'c', label: 'C', type: 'single', options: ['X', 'Y'] }
    const links = [link('a', 'Oui', 'character', 'A'), link('b', 'Non', 'character', 'B'), link('c', 'X', 'character', 'C')]
    const people = [...times(30, { a: 'Oui', b: 'Oui', c: 'X' }), ...times(30, { a: 'Non', b: 'Non', c: 'X' })]
    const { findings } = questionnaireFindings([a, b, c], links, [character('A'), character('B'), character('C'), character('D')], people)
    const reviews = findings.filter((finding) => finding.level === 'review').map((finding) => finding.kind)
    expect(reviews).toEqual(['characterWithoutLink', 'dominantAnswer', 'duplicateQuestions'])
    expect(findings[0]?.kind).toBe('characterWithoutLink')
  })
})

describe('qui compte dans les réponses (US-136, R7)', () => {
  it('une personne compte une fois, par sa dernière inscription qui contient des réponses', () => {
    expect(latestAnswersPerPerson([
      { participantId: 'a', questionAnswers: { style: 'Combat' } },
      { participantId: 'a', questionAnswers: { style: 'Intrigue' } },
      { participantId: 'b', questionAnswers: null },
      { participantId: 'b', questionAnswers: { style: null, envies: [] } },
      { participantId: 'b', questionAnswers: { style: 'Mystère' } },
      { participantId: 'c', questionAnswers: {} }
    ])).toEqual([{ style: 'Combat' }, { style: 'Mystère' }])
  })

  it('une question sans lien n’est pas jugée', () => {
    const { findings, respondentCount } = answerFindings(questions, [link('niveau', '', 'character', 'A')], [character('A')], times(20, { style: 'Intrigue' }))
    expect(findings).toEqual([])
    expect(respondentCount).toBe(0)
  })

  it('une réponse à une option retirée est laissée de côté et comptée dans le détail', () => {
    const { findings } = answerFindings(questions, [link('style', 'Intrigue', 'character', 'A')], [character('A')], [...times(20, { style: 'Intrigue' }), ...times(3, { style: 'Ancienne' })])
    expect(findings).toContainEqual(expect.objectContaining({ kind: 'dominantAnswer', count: 20, total: 20, ignored: 3 }))
  })
})

describe('question qui ne départage pas (US-136, R8)', () => {
  const links = [link('style', 'Intrigue', 'character', 'A')]
  const dominant = (people: Array<Record<string, unknown>>) => answerFindings(questions, links, [character('A')], people).findings.filter((finding) => finding.kind === 'dominantAnswer')

  it('à revoir quand la borne basse de Wilson atteint 0,8', () => {
    expect(dominant(times(16, { style: 'Intrigue' }))).toEqual([expect.objectContaining({ level: 'review', option: 'Intrigue', count: 16, total: 16, share: 1, threshold: 0.8, entropy: 0, shares: null })])
  })

  it('à confirmer quand seule la proportion l’atteint', () => {
    expect(dominant([...times(8, { style: 'Intrigue' }), ...times(2, { style: 'Combat' })])).toEqual([expect.objectContaining({ level: 'unsure', count: 8, total: 10, share: 0.8 })])
  })

  it('rien sous 8 personnes sur 10', () => {
    expect(dominant([...times(7, { style: 'Intrigue' }), ...times(3, { style: 'Combat' })])).toEqual([])
  })

  it('choix multiple : chaque option est jugée, et le détail donne la part de chaque option', () => {
    const { findings } = answerFindings(questions, [link('envies', 'Romance', 'character', 'A')], [character('A')], [...times(9, { envies: ['Romance'] }), { envies: ['Romance', 'Trahison'] }, { envies: [] }])
    expect(findings.filter((finding) => finding.kind === 'dominantAnswer')).toEqual([expect.objectContaining({
      level: 'unsure',
      option: 'Romance',
      count: 10,
      total: 10,
      entropy: null,
      shares: [{ option: 'Romance', share: 1 }, { option: 'Trahison', share: 0.1 }]
    })])
  })
})

describe('échelle tassée (US-136, R9)', () => {
  const links = [link('niveau', '', 'character', 'A')]
  const ends = (people: Array<Record<string, unknown>>) => answerFindings(questions, links, [character('A')], people).findings.filter((finding) => finding.kind === 'scaleEnd')
  const notes = (counts: number[]) => counts.flatMap((count, index) => times(count, { niveau: index + 1 }))

  it('une échelle bien répartie n’est pas signalée', () => {
    expect(ends(notes([20, 20, 20, 20, 20]))).toEqual([])
  })

  it('à revoir quand la borne basse dépasse 20 %', () => {
    expect(ends(notes([2, 3, 5, 10, 30]))).toEqual([expect.objectContaining({ level: 'review', option: '5', count: 30, total: 50, threshold: 0.2 })])
  })

  it('à confirmer quand seule la proportion dépasse 20 %', () => {
    expect(ends(notes([1, 2, 2, 2, 3]))).toEqual([expect.objectContaining({ level: 'unsure', option: '5', count: 3, total: 10 })])
  })

  it('une note déjà signalée par la règle des 8 sur 10 ne l’est pas deux fois', () => {
    const { findings } = answerFindings(questions, links, [character('A')], notes([0, 0, 0, 0, 20]))
    expect(findings.map((finding) => finding.kind)).toContain('dominantAnswer')
    expect(findings.map((finding) => finding.kind)).not.toContain('scaleEnd')
  })
})

describe('questions qui font doublon (US-137, R10)', () => {
  const choice = (id: string): QualityQuestion => ({ id, label: id, type: 'single', options: ['Oui', 'Non'] })
  const scale = (id: string): QualityQuestion => ({ id, label: id, type: 'scale', options: [] })
  const duplicates = (list: QualityQuestion[], people: Array<Record<string, unknown>>) =>
    answerFindings(list, list.map((question) => link(question.id, question.type === 'scale' ? '' : 'Oui', 'character', 'A')), [character('A')], people).findings.filter((finding) => finding.kind === 'duplicateQuestions')

  it('deux questions presque identiques, avec assez de réponses : à revoir, avec la réponse la plus liée', () => {
    const people = [...times(48, { a: 'Oui', b: 'Oui' }), ...times(48, { a: 'Non', b: 'Non' }), ...times(2, { a: 'Oui', b: 'Non' }), ...times(2, { a: 'Non', b: 'Oui' })]
    expect(duplicates([choice('a'), choice('b')], people)).toEqual([expect.objectContaining({
      level: 'review',
      method: 'cramer',
      n: 100,
      threshold: 0.5,
      cochran: true,
      strongest: { firstOption: 'Oui', secondOption: 'Oui', count: 48, firstCount: 50 }
    })])
  })

  it('un lien fort sur peu de réponses, conditions de Cochran non remplies : à confirmer', () => {
    const people = [...times(4, { a: 'Oui', b: 'Oui' }), ...times(4, { a: 'Non', b: 'Non' })]
    expect(duplicates([choice('a'), choice('b')], people)).toEqual([expect.objectContaining({ level: 'unsure', cochran: false, adjustedP: null })])
  })

  it('des conditions remplies mais un test qui ne confirme pas : à confirmer', () => {
    const people = [...times(14, { a: 'Oui', b: 'Oui' }), ...times(14, { a: 'Non', b: 'Non' }), ...times(4, { a: 'Oui', b: 'Non' }), ...times(4, { a: 'Non', b: 'Oui' })]
    expect(duplicates([choice('a'), choice('b')], people)).toEqual([expect.objectContaining({ level: 'unsure', cochran: true, value: expect.any(Number), adjustedP: expect.any(Number) })])
  })

  it('sous le seuil, rien n’est affiché', () => {
    const people = [...times(10, { a: 'Oui', b: 'Oui' }), ...times(10, { a: 'Non', b: 'Non' }), ...times(10, { a: 'Oui', b: 'Non' }), ...times(10, { a: 'Non', b: 'Oui' })]
    expect(duplicates([choice('a'), choice('b')], people)).toEqual([])
  })

  it('une question à laquelle tout le monde a répondu pareil n’est pas comparée', () => {
    expect(duplicates([choice('a'), choice('b')], times(30, { a: 'Oui', b: 'Oui' }))).toEqual([])
  })

  it('seules les personnes qui ont répondu aux deux questions comptent', () => {
    const people = [...times(4, { a: 'Oui', b: 'Oui' }), ...times(4, { a: 'Non', b: 'Non' }), ...times(20, { a: 'Oui' })]
    expect(duplicates([choice('a'), choice('b')], people)).toEqual([expect.objectContaining({ n: 8 })])
  })

  it('deux échelles opposées font doublon : Spearman en valeur absolue', () => {
    const people = [1, 2, 3, 4, 5].flatMap((note) => times(10, { a: note, b: 6 - note }))
    expect(duplicates([scale('a'), scale('b')], people)).toEqual([expect.objectContaining({ level: 'review', method: 'spearman', value: 1, lower: 1, cochran: null })])
  })

  it('deux échelles avec 3 réponses ne sont pas affichées : pas d’intervalle possible', () => {
    const people = [{ a: 1, b: 1 }, { a: 2, b: 2 }, { a: 3, b: 3 }]
    expect(duplicates([scale('a'), scale('b')], people)).toEqual([])
    expect(duplicates([scale('a'), scale('b')], [...people, { a: 4, b: 3 }])).toEqual([expect.objectContaining({ level: 'unsure', n: 4, lower: expect.any(Number), adjustedP: expect.any(Number) })])
  })
})

describe('personnages indistincts chez les inscrits (US-138, R11)', () => {
  const two: QualityQuestion[] = [
    { id: 'q1', label: 'q1', type: 'single', options: ['Oui', 'Non'] },
    { id: 'q2', label: 'q2', type: 'single', options: ['Oui', 'Non'] }
  ]
  const indistinct = (links: ReturnType<typeof link>[], people: Array<Record<string, unknown>>, characters = [character('A'), character('B')]) =>
    answerFindings(two, links, characters, people).findings.filter((finding) => finding.kind === 'indistinctByAnswers')
  const sameNotes = [link('q1', 'Oui', 'character', 'A'), link('q1', 'Oui', 'character', 'B')]

  it('des notes qui varient ensemble, avec assez de réponses : à revoir', () => {
    expect(indistinct(sameNotes, [...times(10, { q1: 'Oui' }), ...times(10, { q1: 'Non' })])).toEqual([expect.objectContaining({ level: 'review', correlation: 1, threshold: 0.85, n: 20 })])
  })

  it('avec 3 réponses, rien n’est affiché : pas d’intervalle possible', () => {
    expect(indistinct(sameNotes, [{ q1: 'Oui' }, { q1: 'Non' }, { q1: 'Non' }])).toEqual([])
  })

  it('une corrélation forte sans certitude : à confirmer', () => {
    // Une réponse en désaccord sur 13 : r = 36 / 42, soit 0,857, trop peu de réponses pour conclure
    const links = [link('q1', 'Oui', 'character', 'A'), link('q2', 'Oui', 'character', 'B')]
    const people = [...times(6, { q1: 'Oui', q2: 'Oui' }), ...times(6, { q1: 'Non', q2: 'Non' }), { q1: 'Oui', q2: 'Non' }]
    expect(indistinct(links, people)).toEqual([expect.objectContaining({ level: 'unsure', n: 13, lower: expect.any(Number) })])
  })

  it('une corrélation sous le seuil n’est pas signalée', () => {
    const links = [link('q1', 'Oui', 'character', 'A'), link('q2', 'Oui', 'character', 'B')]
    const people = [...times(5, { q1: 'Oui', q2: 'Oui' }), ...times(5, { q1: 'Non', q2: 'Non' }), ...times(5, { q1: 'Oui', q2: 'Non' }), ...times(5, { q1: 'Non', q2: 'Oui' })]
    expect(indistinct(links, people)).toEqual([])
  })

  it('un personnage à la note constante n’est pas comparé', () => {
    expect(indistinct(sameNotes, times(10, { q1: 'Oui' }))).toEqual([])
  })

  it('la correction de Holm tient compte de toutes les paires testées', () => {
    const people = [...times(19, { q1: 'Oui', q2: 'Oui' }), ...times(20, { q1: 'Non', q2: 'Non' }), { q1: 'Oui', q2: 'Non' }]
    const pair = [link('q1', 'Oui', 'character', 'A'), link('q2', 'Oui', 'character', 'B')]
    const adjustedOfPair = (findings: ReturnType<typeof indistinct>) => {
      const found = findings.find((finding) => finding.kind === 'indistinctByAnswers' && finding.characters[0].name === 'A' && finding.characters[1].name === 'B')
      return found?.kind === 'indistinctByAnswers' ? found.adjustedP! : Number.NaN
    }
    const alone = adjustedOfPair(indistinct(pair, people))
    // Huit personnages de plus, aux notes variables : 45 paires testées au lieu d'une
    const others = Array.from({ length: 8 }, (_, index) => character(`C${index}`, { factions: [{ id: `f${index}`, name: `f${index}` }] }))
    const crowd = [...pair, ...others.map((_, index) => link(index % 2 ? 'q1' : 'q2', index % 2 ? 'Non' : 'Oui', 'faction', `f${index}`))]
    const crowded = adjustedOfPair(indistinct(crowd, people, [character('A'), character('B'), ...others]))
    expect(crowded).toBeGreaterThan(alone)
  })
})

describe('personnages peu ou trop demandés (US-139, R12)', () => {
  const style = questions[0]!
  const demand = (links: ReturnType<typeof link>[], characters: QualityCharacter[], people: Array<Record<string, unknown>>) =>
    answerFindings([style], links, characters, people).findings.filter((finding) => finding.kind === 'rarelyWanted' || finding.kind === 'overWanted')

  it('un personnage en tête de plus de 3 personnes est disputé, un autre peu demandé', () => {
    const links = [link('style', 'Intrigue', 'character', 'A'), link('style', 'Combat', 'character', 'B')]
    expect(demand(links, [character('A'), character('B')], [...times(4, { style: 'Intrigue' }), { style: 'Combat' }])).toEqual([
      { kind: 'overWanted', level: 'watch', character: { id: 'A', name: 'A' }, count: 4, respondents: 5 },
      { kind: 'rarelyWanted', level: 'watch', character: { id: 'B', name: 'B' }, count: 1, respondents: 5 }
    ])
  })

  it('les ex æquo comptent parmi les meilleurs ; une note nulle ne compte pas', () => {
    const links = ['A', 'B', 'C', 'D'].map((id) => link('style', 'Intrigue', 'character', id))
    const characters = ['A', 'B', 'C', 'D'].map((id) => character(id))
    expect(demand(links, characters, [...times(3, { style: 'Intrigue' }), { style: 'Combat' }])).toEqual([])
  })

  it('peu demandé n’est pas affiché sous la moitié des personnages en réponses', () => {
    const ids = ['A', 'B', 'C', 'D', 'E', 'F']
    const links = ids.map((id) => link('style', id === 'A' ? 'Intrigue' : 'Combat', 'character', id))
    const characters = ids.map((id) => character(id))
    expect(demand(links, characters, times(2, { style: 'Intrigue' }))).toEqual([])
    expect(demand(links, characters, times(3, { style: 'Intrigue' })).filter((finding) => finding.kind === 'rarelyWanted')).toHaveLength(5)
  })

  it('un personnage sans lien garde son seul repère de lien', () => {
    expect(demand([link('style', 'Intrigue', 'character', 'A')], [character('A'), character('B')], times(2, { style: 'Intrigue' }))).toEqual([])
  })
})
