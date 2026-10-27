import { describe, expect, it } from 'vitest'
import { decryptSmtpPassword, encryptSmtpPassword } from '~/server/utils/email'
import { runtimeConfig } from '../setup'

describe('chiffrement du mot de passe SMTP', () => {
  it('déchiffre ce qu’il a chiffré', () => {
    runtimeConfig.smtpEncryptionSecret = 'secret-de-test'
    const encrypted = encryptSmtpPassword('mot de passe SMTP')

    expect(encrypted).not.toContain('mot de passe')
    expect(decryptSmtpPassword(encrypted)).toBe('mot de passe SMTP')
  })

  it('produit un chiffré différent à chaque fois (IV aléatoire)', () => {
    runtimeConfig.smtpEncryptionSecret = 'secret-de-test'
    expect(encryptSmtpPassword('x')).not.toBe(encryptSmtpPassword('x'))
  })

  it('refuse un chiffré altéré', () => {
    runtimeConfig.smtpEncryptionSecret = 'secret-de-test'
    const [iv, tag, data] = encryptSmtpPassword('mot de passe').split(':')
    const tampered = [iv, tag, data!.slice(0, -2) + (data!.endsWith('AA') ? 'BB' : 'AA')].join(':')

    expect(() => decryptSmtpPassword(tampered)).toThrow()
  })

  it('refuse de déchiffrer avec un autre secret', () => {
    runtimeConfig.smtpEncryptionSecret = 'secret-de-test'
    const encrypted = encryptSmtpPassword('mot de passe')
    runtimeConfig.smtpEncryptionSecret = 'autre-secret'

    expect(() => decryptSmtpPassword(encrypted)).toThrow()
  })
})
