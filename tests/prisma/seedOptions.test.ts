// US-150, US-151 : réglages du rechargement des jeux de test (ADR-0066)
import { describe, expect, it } from 'vitest'
import { daysFromNow, personAddress, readSeedOptions } from '../../prisma/seed/options'

describe('readSeedOptions', () => {
  it('refuse sans confirmation explicite', () => {
    expect(() => readSeedOptions({})).toThrow('SEED_ALLOW_ERASE=1')
    expect(() => readSeedOptions({ SEED_ALLOW_ERASE: 'true' })).toThrow('SEED_ALLOW_ERASE=1')
  })

  it('n\'exige ni adresse ni mot de passe', () => {
    expect(readSeedOptions({ SEED_ALLOW_ERASE: '1' })).toEqual({ ownerEmail: null, password: null, replaceBySlug: false })
  })

  it('normalise l\'adresse et refuse une adresse invalide', () => {
    expect(readSeedOptions({ SEED_ALLOW_ERASE: '1', SEED_EMAIL: ' Nom@Exemple.test ' }).ownerEmail).toBe('nom@exemple.test')
    expect(() => readSeedOptions({ SEED_ALLOW_ERASE: '1', SEED_EMAIL: 'pas-une-adresse' })).toThrow('SEED_EMAIL')
  })

  it('refuse un mot de passe trop court, sans le répéter', () => {
    expect(() => readSeedOptions({ SEED_ALLOW_ERASE: '1', SEED_PASSWORD: 'court' })).toThrow(/^(?!.*court\b).*SEED_PASSWORD/)
    expect(readSeedOptions({ SEED_ALLOW_ERASE: '1', SEED_PASSWORD: 'assez-long' }).password).toBe('assez-long')
  })

  it('ne remplace par adresse de page que sur demande', () => {
    expect(readSeedOptions({ SEED_ALLOW_ERASE: '1', SEED_REPLACE_BY_SLUG: '1' }).replaceBySlug).toBe(true)
  })
})

describe('personAddress', () => {
  it('dirige une personne qui reçoit vers la boîte de la propriétaire', () => {
    expect(personAddress('camille.bernard@example.test', 'nom@exemple.test')).toBe('nom+camille.bernard@exemple.test')
    expect(personAddress('manon.richard@example.test', 'nom@exemple.test')).toBe('nom+manon.richard@exemple.test')
  })

  it('laisse les autres, et tout le monde sans adresse de base, en example.test', () => {
    expect(personAddress('hugo.fontaine@example.test', 'nom@exemple.test')).toBe('hugo.fontaine@example.test')
    expect(personAddress('camille.bernard@example.test', null)).toBe('camille.bernard@example.test')
  })
})

describe('daysFromNow', () => {
  const now = new Date('2026-11-05T23:30:00Z')

  it('compte les jours à partir d\'aujourd\'hui, à midi UTC', () => {
    expect(daysFromNow(10, now).toISOString()).toBe('2026-11-15T12:00:00.000Z')
    expect(daysFromNow(-60, now).toISOString()).toBe('2026-09-06T12:00:00.000Z')
    expect(daysFromNow(0, now).toISOString()).toBe('2026-11-05T12:00:00.000Z')
  })
})
