import { describe, expect, it } from 'vitest'
import { apiErrorMessage, apiFieldErrors } from '~/utils/apiErrors'

const validation = { data: { message: 'Invalid request body', data: { data: [{ path: 'phone', message: 'Le téléphone est obligatoire' }, { path: 'email', message: 'Email invalide' }] } } }

describe('apiErrorMessage', () => {
  it('montre le détail d’une validation plutôt que « Invalid request body »', () => {
    expect(apiErrorMessage(validation, 'Erreur')).toBe('Le téléphone est obligatoire ; Email invalide')
  })

  it('sinon le message du serveur, sinon le texte par défaut', () => {
    expect(apiErrorMessage({ data: { message: 'Période introuvable' } }, 'Erreur')).toBe('Période introuvable')
    expect(apiErrorMessage(null, 'Erreur')).toBe('Erreur')
  })
})

describe('apiFieldErrors', () => {
  it('range chaque message sous son champ', () => {
    expect(apiFieldErrors(validation)).toEqual({ phone: 'Le téléphone est obligatoire', email: 'Email invalide' })
    expect(apiFieldErrors({ data: { message: 'x' } })).toEqual({})
  })
})
