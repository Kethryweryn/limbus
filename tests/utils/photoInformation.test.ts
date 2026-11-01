import { describe, expect, it } from 'vitest'
import { gamePhotoInformation, photoContactEmail, photoInformation } from '~/utils/photoInformation'

// US-107 : le texte d'information sur les photos
describe('information sur les photos', () => {
  it('dit l’usage, les destinataires, la durée et le moyen de retrait', () => {
    const text = photoInformation({ retentionMonths: 6, contactEmail: 'equipe@example.test' })
    expect(text).toContain('trombinoscope de la session')
    expect(text).toContain('envoyé aux joueurs de la session')
    expect(text).toContain('supprimée 6 mois après la session')
    expect(text).toContain('« Je participe »')
    expect(text).toContain('en écrivant à equipe@example.test')
  })

  it('prend le contact du jeu, sinon l’adresse de la propriétaire', () => {
    expect(photoContactEmail({ contactEmail: 'contact@example.test', owner: { email: 'proprio@example.test' } })).toBe('contact@example.test')
    expect(photoContactEmail({ contactEmail: null, owner: { email: 'proprio@example.test' } })).toBe('proprio@example.test')
    expect(photoContactEmail({ contactEmail: '', owner: null })).toBeNull()
    expect(gamePhotoInformation({ photoRetentionMonths: 12, contactEmail: null, owner: null })).not.toContain('en écrivant')
  })
})
