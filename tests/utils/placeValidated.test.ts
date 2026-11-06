import { describe, expect, it } from 'vitest'
import { isPlaceValidated } from '~/utils/sessionTariffs'

type TariffOf = Parameters<typeof isPlaceValidated>[0]['tariffs'][number]
const payment = (fields: Partial<NonNullable<Parameters<typeof isPlaceValidated>[0]['payment']>> = {}) => ({ paidAt: null, offered: false, tariffId: null, refundStatus: null, transferredToParticipantId: null, instalments: [], ...fields })
const pj = { id: 't1', name: 'Joueur', amountCents: 5000, defaultRole: 'pj', basePriceCents: null, sliding: false } as unknown as TariffOf

describe('inscrite validée (R18)', () => {
  it('en mode simple, à la case « payé »', () => {
    expect(isPlaceValidated({ tariffs: [], roles: ['pj'], payment: null })).toBe(false)
    expect(isPlaceValidated({ tariffs: [], roles: ['pj'], payment: payment({ paidAt: new Date() }) })).toBe(true)
  })

  it('en mode tarifs, au premier versement ; le retirer la ramène à « inscrite »', () => {
    expect(isPlaceValidated({ tariffs: [pj], roles: ['pj'], payment: payment() })).toBe(false)
    expect(isPlaceValidated({ tariffs: [pj], roles: ['pj'], payment: payment({ instalments: [{}] }) })).toBe(true)
  })

  it('rien à payer : place offerte, aucun tarif pour elle, ou tarif à zéro', () => {
    expect(isPlaceValidated({ tariffs: [pj], roles: ['pj'], payment: payment({ offered: true }) })).toBe(true)
    expect(isPlaceValidated({ tariffs: [pj], roles: ['kitchen'], payment: null })).toBe(true)
    expect(isPlaceValidated({ tariffs: [{ ...pj, amountCents: 0 }], roles: ['pj'], payment: null })).toBe(true)
  })

  it('un paiement à rembourser, remboursé ou transféré ne compte pas', () => {
    expect(isPlaceValidated({ tariffs: [], roles: ['pj'], payment: payment({ paidAt: new Date(), refundStatus: 'to_refund' }) })).toBe(false)
    expect(isPlaceValidated({ tariffs: [pj], roles: ['pj'], payment: payment({ instalments: [{}], transferredToParticipantId: 'p2' }) })).toBe(false)
  })
})
