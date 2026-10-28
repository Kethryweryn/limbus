import { describe, expect, it, vi } from 'vitest'
import { decryptSmtpPassword, encryptSmtpPassword, gameBequestInvitationEmailText, sendEmail } from '~/server/utils/email'
import { prisma } from '~/server/utils/prisma'
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

describe('échec d’envoi SMTP', () => {
  it('journalise la cause sans le destinataire, puis renvoie une 502 lisible', async () => {
    const authError = Object.assign(new Error('Invalid login'), {
      code: 'EAUTH',
      responseCode: 535,
      command: 'AUTH PLAIN',
      response: '535 5.7.8 Authentication failed'
    })
    vi.doMock('nodemailer', () => ({ createTransport: () => ({ sendMail: vi.fn().mockRejectedValue(authError) }) }))
    Object.assign(prisma, {
      smtpSettings: {
        findUnique: vi.fn().mockResolvedValue({ enabled: true, host: 'smtp.example.test', port: 587, secure: false, username: null, passwordEncrypted: null, fromEmail: 'limbus@example.test', fromName: null })
      }
    })
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(sendEmail({ to: 'joueuse@example.test', subject: 'Sujet', text: 'Texte' }))
      .rejects.toMatchObject({ statusCode: 502, message: expect.stringContaining('Authentification SMTP refusée') })

    expect(log).toHaveBeenCalledWith("[smtp] échec d'envoi via smtp.example.test:587", expect.objectContaining({ code: 'EAUTH', responseCode: 535 }))
    expect(JSON.stringify(log.mock.calls)).not.toContain('joueuse@example.test')
    log.mockRestore()
    vi.doUnmock('nodemailer')
  })
})

describe('invitation au legs d’un jeu (US-011)', () => {
  it('dit qui lègue quel jeu, donne le lien et sa date limite', () => {
    const text = gameBequestInvitationEmailText({
      gameTitle: 'Les Brumes',
      ownerName: 'Alice',
      url: 'https://limbus.example/invitations/abc',
      expiresAt: new Date('2027-01-15T12:00:00Z')
    })
    expect(text).toContain('Alice vous lègue une copie de son jeu « Les Brumes »')
    expect(text).toContain('https://limbus.example/invitations/abc')
    expect(text).toContain('valable jusqu’au 15 janvier 2027')
    expect(text).toContain('la copie est supprimée')
  })
})
