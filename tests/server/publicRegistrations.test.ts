import { describe, expect, it, vi } from 'vitest'
import { prisma } from '~/server/utils/prisma'
import {
  findRegistrationByToken,
  registrationConfirmationEmailText,
  registrationPermissions
} from '~/server/utils/publicRegistrations'

const open = { state: 'open', closesAt: null }
const closed = { state: 'closed', closesAt: null }
const period = (state: typeof open) => ({ ...state, gameId: 'g', game: { title: 'Jeu', noteIntention: null }, sessions: [] })

describe('registrationPermissions (R13)', () => {
  it('une invitation s’accepte ou se décline, même après la clôture', () => {
    expect(registrationPermissions({ status: 'invited', period: period(open) })).toEqual({ canAccept: true, canDecline: true, canEdit: false, canWithdraw: false })
    expect(registrationPermissions({ status: 'invited', period: period(closed) })).toEqual({ canAccept: true, canDecline: true, canEdit: false, canWithdraw: false })
  })

  it('une inscription confirmée se modifie jusqu’à la clôture seulement', () => {
    expect(registrationPermissions({ status: 'confirmed', period: period(open) })).toMatchObject({ canEdit: true, canAccept: false, canWithdraw: true })
    // Le désistement reste possible après la clôture (US-006)
    expect(registrationPermissions({ status: 'confirmed', period: period(closed) })).toMatchObject({ canEdit: false, canWithdraw: true })
    const pastClosing = { state: 'open', closesAt: '2020-01-01T00:00:00Z' } as unknown as typeof open
    expect(registrationPermissions({ status: 'confirmed', period: period(pastClosing) })).toMatchObject({ canEdit: false })
  })

  it('une inscription désistée ne permet plus rien', () => {
    expect(registrationPermissions({ status: 'withdrawn', period: period(open) })).toEqual({ canAccept: false, canDecline: false, canEdit: false, canWithdraw: false })
  })
})

describe('findRegistrationByToken', () => {
  it('ne consulte pas la base pour un jeton mal formé', async () => {
    const findUnique = vi.fn()
    Object.assign(prisma, { registration: { findUnique } })
    expect(await findRegistrationByToken('court')).toBeNull()
    expect(await findRegistrationByToken(undefined)).toBeNull()
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('cherche par le hash du jeton, et refuse un lien expiré', async () => {
    const token = 'a'.repeat(43)
    const findUnique = vi.fn().mockResolvedValue({ session: { date: new Date('2020-01-01') }, period: { sessions: [] } })
    Object.assign(prisma, { registration: { findUnique } })
    expect(await findRegistrationByToken(token)).toBeNull()
    expect(findUnique.mock.calls[0]![0].where.tokenHash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('email de confirmation', () => {
  it('reprend le jeu, la session et le lien, sans données de santé', () => {
    const text = registrationConfirmationEmailText({
      firstName: 'Zoé',
      gameTitle: 'Les Ombres',
      sessionName: 'Printemps',
      sessionDate: new Date('2027-03-10T09:00:00Z'),
      url: 'https://limbus.example/inscription/abc'
    })
    expect(text).toContain('Bonjour Zoé,')
    expect(text).toContain('Votre inscription à « Les Ombres » pour la session Printemps (10 mars 2027) est confirmée.')
    expect(text).toContain('https://limbus.example/inscription/abc')
  })
})
