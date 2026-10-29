import { describe, expect, it } from 'vitest'
import { accountDeletionEmailText } from '~/server/utils/accountDeletion'

// Email aux équipes après l'effacement d'un compte (US-077)
describe('accountDeletionEmailText', () => {
  it('cite les places libérées et les paiements à régler à la main', () => {
    const text = accountDeletionEmailText('Camille', { title: 'Le Bal', sessions: new Set(['Printemps', 'Automne']), payments: ['Printemps : 45,00 € reçus'] })
    expect(text).toContain('« Le Bal »')
    expect(text).toContain('Printemps, Automne')
    expect(text).toContain('- Printemps : 45,00 € reçus')
  })

  it('sans place ni paiement', () => {
    const text = accountDeletionEmailText('Camille', { title: 'Le Bal', sessions: new Set(), payments: [] })
    expect(text).toContain('Aucune place à libérer')
    expect(text).not.toContain('Paiements reçus')
  })
})
