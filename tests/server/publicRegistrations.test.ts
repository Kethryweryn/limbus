import { describe, expect, it, vi } from 'vitest'
import { prisma } from '~/server/utils/prisma'
import {
  withdrawalReason,
  findRegistrationByToken,
  registrationConfirmationEmailText,
  registrationPermissions
} from '~/server/utils/publicRegistrations'

describe('registrationPermissions (R14)', () => {
  it('une invitation s’accepte ou se décline', () => {
    expect(registrationPermissions({ status: 'invited' })).toEqual({ canAccept: true, canDecline: true, canEdit: false, canLeave: false })
  })

  it('dans le vivier, on modifie ses réponses et on peut le quitter', () => {
    expect(registrationPermissions({ status: 'received' })).toEqual({ canAccept: false, canDecline: false, canEdit: true, canLeave: true })
  })

  it('sortie du vivier, plus rien', () => {
    expect(registrationPermissions({ status: 'withdrawn' })).toEqual({ canAccept: false, canDecline: false, canEdit: false, canLeave: false })
  })
})

describe('findRegistrationByToken', () => {
  it('ne consulte pas la base pour un jeton mal formé', async () => {
    const findFirst = vi.fn()
    Object.assign(prisma, { registration: { findFirst } })
    expect(await findRegistrationByToken('court')).toBeNull()
    expect(await findRegistrationByToken(undefined)).toBeNull()
    expect(findFirst).not.toHaveBeenCalled()
  })

  it('cherche par le hash du jeton, et le lien n’expire pas (ADR-0070)', async () => {
    const token = 'a'.repeat(43)
    const found = { id: 'r1' }
    const findFirst = vi.fn().mockResolvedValue(found)
    Object.assign(prisma, { registration: { findFirst } })
    expect(await findRegistrationByToken(token)).toBe(found)
    expect(findFirst.mock.calls[0]![0].where.links.some.tokenHash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('email de confirmation', () => {
  it('reprend le jeu et le lien, sans données de santé', () => {
    const text = registrationConfirmationEmailText({
      firstName: 'Zoé',
      gameTitle: 'Les Ombres',
      url: 'https://limbus.example/inscription/abc'
    })
    expect(text).toContain('Bonjour Zoé,')
    expect(text).toContain('Vos réponses au questionnaire de « Les Ombres » sont enregistrées.')
    expect(text).toContain('https://limbus.example/inscription/abc')
  })
})

describe('withdrawalReason', () => {
  it('distingue refus, sortie du vivier, invitation retirée et retrait par l’équipe', () => {
    expect(withdrawalReason({ charterAcceptedAt: null, withdrawnById: null })).toBe('declined')
    expect(withdrawalReason({ charterAcceptedAt: new Date(), withdrawnById: null })).toBe('left')
    expect(withdrawalReason({ charterAcceptedAt: null, withdrawnById: 'orga' })).toBe('released')
    expect(withdrawalReason({ charterAcceptedAt: new Date(), withdrawnById: 'orga' })).toBe('removed')
  })
})
