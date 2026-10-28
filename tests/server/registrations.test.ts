import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { runtimeConfig } from '../setup'
import { registrationInvitationSchema } from '~/server/utils/schemas'
import {
  createRegistrationToken,
  hashRegistrationToken,
  participantEmailMatchWhere,
  registrationInvitationEmailText,
  registrationResponseDueAt,
  registrationUrl,
  registrationWithdrawalEmailText,
  rethrowAlreadyRegistered
} from '~/server/utils/registrations'

describe('jeton du lien personnel (ADR-0018)', () => {
  it('32 octets aléatoires en base64url, dont seul le SHA-256 est gardé', () => {
    const { token, tokenHash } = createRegistrationToken()
    expect(token).toMatch(/^[\w-]{43}$/)
    expect(tokenHash).toBe(createHash('sha256').update(token).digest('hex'))
    expect(hashRegistrationToken(token)).toBe(tokenHash)
  })

  it('deux jetons ne se ressemblent pas', () => {
    expect(createRegistrationToken().token).not.toBe(createRegistrationToken().token)
  })

  it('le lien passe par l’URL publique configurée', () => {
    runtimeConfig.publicAppUrl = 'https://limbus.example/'
    expect(registrationUrl('abc')).toBe('https://limbus.example/inscription/abc')
  })
})

describe('échéance de réponse', () => {
  it('aujourd’hui plus le délai de la période', () => {
    expect(registrationResponseDueAt(7, new Date('2027-01-01T10:00:00Z')).toISOString()).toBe('2027-01-08T10:00:00.000Z')
  })
})

describe('rapprochement par email (R12)', () => {
  it('ignore la casse et se limite aux jeux de la même propriétaire', () => {
    expect(participantEmailMatchWhere({ id: 'game-1', ownerId: 'alice' }, ' Joueur@Example.test ')).toEqual({
      email: { equals: 'Joueur@Example.test', mode: 'insensitive' },
      gameLinks: { some: { game: { ownerId: 'alice' } } }
    })
  })

  it('un jeu sans propriétaire ne regarde que ses propres participants', () => {
    expect(participantEmailMatchWhere({ id: 'game-1', ownerId: null }, 'x@example.test').gameLinks).toEqual({ some: { gameId: 'game-1' } })
  })
})

describe('registrationInvitationSchema', () => {
  it('accepte des participants existants ou une nouvelle personne, email en minuscules', () => {
    expect(registrationInvitationSchema.parse({ sessionId: 's', participantIds: ['p1'] })).toMatchObject({ participantIds: ['p1'] })
    expect(registrationInvitationSchema.parse({ sessionId: 's', newParticipant: { name: 'Zoé', email: 'Zoe@Example.TEST' } }))
      .toMatchObject({ participantIds: [], newParticipant: { name: 'Zoé', email: 'zoe@example.test' } })
  })

  it.each([
    ['personne à inviter', { sessionId: 's' }],
    ['participant en double', { sessionId: 's', participantIds: ['p1', 'p1'] }],
    ['email invalide', { sessionId: 's', newParticipant: { name: 'Zoé', email: 'zoe' } }],
    ['nom manquant', { sessionId: 's', newParticipant: { name: ' ', email: 'zoe@example.test' } }],
    ['session manquante', { participantIds: ['p1'] }]
  ])('refuse : %s', (_label, body) => {
    expect(registrationInvitationSchema.safeParse(body).success).toBe(false)
  })
})

describe('email d’invitation', () => {
  it('donne le jeu, la session et sa date, l’échéance et le lien', () => {
    const text = registrationInvitationEmailText({
      participantName: 'Zoé',
      gameTitle: 'Les Ombres',
      sessionName: 'Printemps',
      sessionDate: new Date('2027-03-10T09:00:00Z'),
      responseDueAt: new Date('2027-02-01T09:00:00Z'),
      inviterName: 'Alice',
      url: 'https://limbus.example/inscription/abc'
    })
    expect(text).toContain('Alice vous invite à jouer à « Les Ombres », session Printemps (10 mars 2027)')
    expect(text).toContain('https://limbus.example/inscription/abc')
    expect(text).toContain('avant le 1 février 2027')
  })
})

describe('rethrowAlreadyRegistered', () => {
  it('transforme le doublon (période, participant) en 409', () => {
    expect(() => rethrowAlreadyRegistered({ code: 'P2002', meta: { target: ['periodId', 'participantId'] } }))
      .toThrow(expect.objectContaining({ statusCode: 409 }))
  })

  it('laisse passer les autres erreurs', () => {
    const error = new Error('autre')
    expect(() => rethrowAlreadyRegistered(error)).toThrow(error)
  })
})

describe('email de désistement aux organisateurs (US-006)', () => {
  it('distingue le désistement par la personne du retrait par une organisatrice', () => {
    const base = { participantName: 'Zoé', gameTitle: 'Les Ombres', sessionName: 'Printemps' }
    expect(registrationWithdrawalEmailText({ ...base, withdrawnBy: null })).toContain('Zoé s’est désisté·e de la session Printemps du jeu « Les Ombres ».')
    expect(registrationWithdrawalEmailText({ ...base, withdrawnBy: 'Alice' })).toContain('Alice a retiré Zoé de la session Printemps du jeu « Les Ombres ».')
    expect(registrationWithdrawalEmailText({ ...base, withdrawnBy: null })).toContain('à traiter à la main')
  })
})
