import { describe, expect, it } from 'vitest'
import { cosineSimilarity, linkFindings, pointProfile, type QualityCharacter, type QualityQuestion } from '~/utils/questionnaireQuality'

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
