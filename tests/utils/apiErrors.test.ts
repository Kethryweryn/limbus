import { describe, expect, it } from 'vitest'
import { NO_NETWORK_MESSAGE, apiErrorMessage, apiFieldErrors } from '~/utils/apiErrors'

const validation = { data: { message: 'Requête invalide', data: { data: [{ path: 'phone', message: 'Le téléphone est obligatoire' }, { path: 'email', message: 'Email invalide' }] } } }

describe('apiErrorMessage', () => {
  it('montre le détail d’une validation plutôt que « Requête invalide »', () => {
    expect(apiErrorMessage(validation, 'Erreur')).toBe('Le téléphone est obligatoire ; Email invalide')
  })

  it('sinon le message du serveur, sinon le texte par défaut', () => {
    expect(apiErrorMessage({ data: { message: 'Période introuvable' } }, 'Erreur')).toBe('Période introuvable')
    expect(apiErrorMessage(null, 'Erreur')).toBe('Erreur')
  })

  it('dit que le réseau manque, plutôt que le texte technique de $fetch (US-214)', () => {
    expect(apiErrorMessage({ name: 'FetchError', message: '[PUT] "/api/account": <no response> Failed to fetch' }, 'Erreur')).toBe(NO_NETWORK_MESSAGE)
    expect(apiErrorMessage({ name: 'FetchError', statusCode: 500, data: { message: 'Panne' } }, 'Erreur')).toBe('Panne')
  })
})

describe('apiFieldErrors', () => {
  it('range chaque message sous son champ', () => {
    expect(apiFieldErrors(validation)).toEqual({ phone: 'Le téléphone est obligatoire', email: 'Email invalide' })
    expect(apiFieldErrors({ data: { message: 'x' } })).toEqual({})
  })
})
