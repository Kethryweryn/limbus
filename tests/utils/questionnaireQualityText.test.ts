import { describe, expect, it } from 'vitest'
import type { QuestionnaireFinding } from '~/utils/questionnaireQuality'
import { describeFinding, qualityScope } from '~/utils/questionnaireQualityText'

const ref = { questionId: 'q', questionLabel: 'Ton style' }
const measure = { ...ref, option: '5', count: 6, total: 10, share: 0.6, lower: 0.2, threshold: 0.2, ignored: 0 }
const named = { id: 'a', name: 'Aldric' }
const questions: Extract<QuestionnaireFinding, { kind: 'duplicateQuestions' }>['questions'] = [{ id: 'a', label: 'Style' }, { id: 'b', label: 'Envie' }]
const duplicate = {
  kind: 'duplicateQuestions' as const,
  questions,
  n: 40,
  strongest: { firstOption: 'Oui', secondOption: 'Non', count: 7, firstCount: 8 }
}

describe('phrases des repères sur les réponses', () => {
  it('une extrémité d’échelle, avec son détail', () => {
    const { sentence, detail } = describeFinding({ kind: 'scaleEnd', level: 'review', ...measure, leik: 0.42 })
    expect(sentence).toBe('6 personnes sur 10 ont donné la note 5 à « Ton style » : l’échelle est tassée à cette extrémité.')
    expect(detail).toContain('Dispersion de Leik : 0,42.')
  })

  it('à confirmer : dit combien de réponses sont reçues, et ce qu’il faudra faire', () => {
    const { todo } = describeFinding({ kind: 'scaleEnd', level: 'unsure', ...measure, leik: 0.42 })
    expect(todo).toBe('Pas encore certain, avec 10 personnes : attendez d’autres réponses. Si cela se confirme : reformulez la question, pour que les notes intermédiaires aient un sens plus clair.')
  })

  it('dit combien de réponses à une option retirée sont laissées de côté', () => {
    const finding: QuestionnaireFinding = { kind: 'dominantAnswer', level: 'review', ...measure, ignored: 2, questionType: 'single', entropy: 0.5, shares: null }
    expect(describeFinding(finding).detail).toContain('2 réponses à une option qui n’existe plus, laissées de côté.')
  })

  it('un doublon, au pluriel et au singulier', () => {
    const plural = describeFinding({ ...duplicate, level: 'review', method: 'cramer', value: 0.7, threshold: 0.5, lower: null, adjustedP: 0.0004, cochran: true })
    expect(plural.sentence).toBe('« Style » et « Envie » font doublon : sur 8 personnes qui répondent « Oui » à la première, 7 répondent « Non » à la seconde.')
    expect(plural.detail).toContain('V de Cramér corrigé : 0,7')
    expect(plural.detail).toContain('Valeur p corrigée par Holm : moins de 0,001.')

    const single = describeFinding({ ...duplicate, strongest: { firstOption: 'Oui', secondOption: 'Non', count: 1, firstCount: 1 }, level: 'unsure', method: 'cramer', value: 0.7, threshold: 0.5, lower: null, adjustedP: null, cochran: false })
    expect(single.sentence).toContain('sur 1 personne qui répond « Oui » à la première, 1 répond « Non » à la seconde.')
    expect(single.detail).toContain('conditions de Cochran non remplies')
    expect(single.detail).toContain('Valeur p corrigée par Holm : non calculable.')
  })

  it('un doublon entre échelles : la borne s’arrondit vers le bas, jamais au seuil sans l’avoir atteint', () => {
    const { detail } = describeFinding({ ...duplicate, level: 'unsure', method: 'spearman', value: 0.9, threshold: 0.5, lower: 0.49996, adjustedP: 0.2, cochran: null })
    expect(detail).toContain('borne basse à 95 % : 0,499 ; seuil : 0,5.')
  })

  it('des personnages indistincts chez les inscrits', () => {
    const { sentence, todo, detail } = describeFinding({ kind: 'indistinctByAnswers', level: 'review', characters: [named, { id: 'b', name: 'Bertrand' }], correlation: 0.95, lower: 0.9, adjustedP: 0.01, threshold: 0.85, n: 30 })
    expect(sentence).toBe('Aldric et Bertrand reçoivent presque les mêmes notes chez les 30 personnes qui ont répondu : le casting aura du mal à les départager.')
    expect(todo).toBe('Reliez d’autres réponses à Aldric sans Bertrand, ou l’inverse.')
    expect(detail).toContain('Corrélation de Pearson des notes : 0,95')
  })

  it('un personnage peu demandé, selon le nombre de personnes', () => {
    const rare = (count: number, respondents: number) => describeFinding({ kind: 'rarelyWanted', level: 'watch', character: named, count, respondents }).sentence
    expect(rare(1, 10)).toBe('Aldric ne figure parmi les 3 personnages les mieux notés que pour 1 personne sur 10 : peu de monde correspond à ce personnage.')
    expect(rare(0, 10)).toBe('Aldric ne figure parmi les 3 personnages les mieux notés d’aucune des 10 personnes qui ont répondu : personne ne correspond à ce personnage pour l’instant.')
    expect(rare(0, 1)).toBe('Aldric ne figure parmi les 3 personnages les mieux notés de la seule personne qui a répondu : personne ne correspond à ce personnage pour l’instant.')
  })

  it('ce sur quoi portent les repères', () => {
    expect(qualityScope(0)).toBe('Ces repères portent sur le formulaire et les liens enregistrés.')
    expect(qualityScope(1)).toBe('Ces repères portent sur le formulaire et les liens enregistrés, et sur les réponses de 1 personne.')
  })
})
