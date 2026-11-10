import { describe, expect, it } from 'vitest'
import { NO_NETWORK_MESSAGE, NO_NETWORK_PAGE_MESSAGE, apiErrorMessage, apiFieldErrors, loadErrorMessage } from '~/utils/apiErrors'

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

  it('ne prend pas une erreur de la page pour une coupure du réseau, ni n’affiche le texte technique de $fetch', () => {
    expect(apiErrorMessage(new TypeError('Cannot read properties of undefined'), 'Erreur')).toBe('Erreur')
    expect(apiErrorMessage({ name: 'FetchError', statusCode: 500, message: '[POST] "/api/auth/signup": 500 Internal Server Error' }, 'Impossible de créer le compte.')).toBe('Impossible de créer le compte.')
    expect(apiErrorMessage(new Error('Cette action n’est pas disponible hors ligne.'), 'Erreur')).toBe('Cette action n’est pas disponible hors ligne.')
  })

  it('au chargement d’une page, le réseau qui manque empêche la page', () => {
    expect(loadErrorMessage({ name: 'FetchError', message: 'Failed to fetch' }, 'Erreur')).toBe(NO_NETWORK_PAGE_MESSAGE)
    expect(loadErrorMessage({ name: 'FetchError', statusCode: 403, data: { message: 'Réservé à l’administration' } }, 'Erreur')).toBe('Réservé à l’administration')
  })
})

describe('apiFieldErrors', () => {
  it('range chaque message sous son champ', () => {
    expect(apiFieldErrors(validation)).toEqual({ phone: 'Le téléphone est obligatoire', email: 'Email invalide' })
    expect(apiFieldErrors({ data: { message: 'x' } })).toEqual({})
  })
})
