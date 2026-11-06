// US-157 : une erreur de chargement ouvre error.vue, avec le vrai code de la réponse
import { describe, expect, it } from 'vitest'
import { pageLoadError } from '~/utils/apiErrors'

describe('pageLoadError', () => {
  it('garde le code de la réponse et ouvre la page d’erreur', () => {
    expect(pageLoadError({ statusCode: 404 }, 'Jeu introuvable')).toMatchObject({ fatal: true, statusCode: 404, message: 'Jeu introuvable' })
    expect(pageLoadError({ statusCode: 500 }, 'Jeu introuvable')).toMatchObject({ statusCode: 500 })
  })

  it('ne prend pas une panne pour une page absente', () => {
    expect(pageLoadError({}, 'Jeu introuvable')).toMatchObject({ statusCode: 500 })
    expect(pageLoadError(null, 'Jeu introuvable')).toMatchObject({ statusCode: 500 })
  })

  it('dit qu’une fiche jamais lue n’est pas disponible hors ligne', () => {
    const offline = Object.assign(new Error('absent'), { statusCode: 404, offlineMissing: true })
    expect(pageLoadError(offline, 'Personnage introuvable')).toMatchObject({ statusCode: 503, message: expect.stringContaining('pas disponible hors ligne') })
  })
})
