import { describe, expect, it } from 'vitest'
import { questionnaireReviewPrompt } from '../../server/mcp/prompts'

// US-145 : le message de la consigne « Relire le questionnaire » (SPEC-016, R12)
describe('questionnaireReviewPrompt', () => {
  it('donne questions, options, signalements, règles avec sources et demande', () => {
    const text = questionnaireReviewPrompt([
      { id: 'style', label: 'Combat ou intrigue ?', type: 'single', options: ['Combat', 'Intrigue'] },
      { id: 'envie', label: 'Ton envie de jouer', type: 'scale', options: [] }
    ])
    expect(text).toContain('1. Combat ou intrigue ? (choix unique)')
    expect(text).toContain('   - Intrigue')
    expect(text).toContain('2. Ton envie de jouer (échelle de 1 à 5)')
    expect(text).toContain('Signalé par Limbus : Question à double sens possible : « ou » dans le libellé.')
    for (const rule of ['Question orientée', 'Présupposé', 'Options qui se chevauchent', 'Terme technique']) expect(text).toContain(rule)
    expect(text).toContain('Willis et Lessler, 1999')
    expect(text).toContain('le défaut, la règle et une réécriture proposée')
    expect(text).toContain('sans rien modifier dans Limbus')
  })

  it('le dit quand il n’y a aucune question', () => {
    expect(questionnaireReviewPrompt([])).toContain('rien à relire')
  })
})
