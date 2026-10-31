import { describe, expect, it } from 'vitest'
import {
  announcedRegistrationStatus,
  countRegistrationsByStatus,
  isAnnouncementPending,
  isResponseOverdue,
  registrationDisplayStatus,
  registrationLinkExpired,
  splitParticipantName
} from '~/utils/registrations'

const now = new Date('2027-01-10T12:00:00Z')

describe('isResponseOverdue (R20)', () => {
  it('une invitation sans réponse dont l’échéance est passée', () => {
    expect(isResponseOverdue({ status: 'invited', responseDueAt: '2027-01-10T11:59:00Z' }, now)).toBe(true)
    expect(isResponseOverdue({ status: 'invited', responseDueAt: '2027-01-10T12:01:00Z' }, now)).toBe(false)
  })

  it('jamais pour une inscription qui a répondu, ni sans échéance', () => {
    expect(isResponseOverdue({ status: 'confirmed', responseDueAt: '2027-01-01' }, now)).toBe(false)
    expect(isResponseOverdue({ status: 'withdrawn', responseDueAt: '2027-01-01' }, now)).toBe(false)
    expect(isResponseOverdue({ status: 'invited', responseDueAt: null }, now)).toBe(false)
  })

  it('une place retenue annoncée dont l’échéance est passée (US-089)', () => {
    expect(isResponseOverdue({ status: 'retained', responseDueAt: '2027-01-09' }, now)).toBe(true)
    // Pas encore annoncée : pas d'échéance
    expect(isResponseOverdue({ status: 'retained', responseDueAt: null }, now)).toBe(false)
  })
})

describe('décisions à annoncer (US-088, ADR-0047)', () => {
  it('une décision de sélection qui diffère de l’annonce est à annoncer', () => {
    expect(isAnnouncementPending({ status: 'retained', sessionId: 's1', announcedStatus: null, announcedSessionId: null })).toBe(true)
    expect(isAnnouncementPending({ status: 'retained', sessionId: 's1', announcedStatus: 'retained', announcedSessionId: 's1' })).toBe(false)
    // Changée de session : à annoncer de nouveau
    expect(isAnnouncementPending({ status: 'retained', sessionId: 's2', announcedStatus: 'retained', announcedSessionId: 's1' })).toBe(true)
    expect(isAnnouncementPending({ status: 'waitlisted', sessionId: null, announcedStatus: 'waitlisted', announcedSessionId: null })).toBe(false)
    // Reçue, confirmée ou désistée : rien à annoncer
    expect(isAnnouncementPending({ status: 'received', announcedStatus: 'waitlisted' })).toBe(false)
    expect(isAnnouncementPending({ status: 'confirmed', announcedStatus: 'retained' })).toBe(false)
  })

  it('la personne voit la dernière décision annoncée, ou « reçue »', () => {
    expect(announcedRegistrationStatus({ status: 'retained', sessionId: 's1', announcedStatus: null })).toBe('received')
    expect(announcedRegistrationStatus({ status: 'retained', sessionId: 's1', announcedStatus: 'waitlisted' })).toBe('waitlisted')
    expect(announcedRegistrationStatus({ status: 'rejected', announcedStatus: 'rejected' })).toBe('rejected')
    expect(announcedRegistrationStatus({ status: 'confirmed', announcedStatus: 'retained' })).toBe('confirmed')
  })
})

describe('registrationLinkExpired (ADR-0018)', () => {
  it('expire 30 jours après la dernière session', () => {
    expect(registrationLinkExpired(['2026-11-01', '2026-12-11T12:00:00Z'], now)).toBe(false)
    expect(registrationLinkExpired(['2026-12-11T11:59:00Z', null], now)).toBe(true)
  })

  it('n’expire pas sans date de session', () => {
    expect(registrationLinkExpired([null, undefined], now)).toBe(false)
    expect(registrationLinkExpired([], now)).toBe(false)
  })
})

describe('splitParticipantName', () => {
  it('prénom puis nom', () => {
    expect(splitParticipantName('  Camille  de la Tour ')).toEqual({ firstName: 'Camille', lastName: 'de la Tour' })
    expect(splitParticipantName('Zoé')).toEqual({ firstName: 'Zoé', lastName: '' })
  })
})

describe('statut montré aux orgas (US-005)', () => {
  it('« délai dépassé » pour une invitation sans réponse après l’échéance, le statut sinon', () => {
    expect(registrationDisplayStatus({ status: 'invited', responseDueAt: '2027-01-09' }, now)).toBe('overdue')
    expect(registrationDisplayStatus({ status: 'invited', responseDueAt: '2027-01-11' }, now)).toBe('invited')
    expect(registrationDisplayStatus({ status: 'confirmed', responseDueAt: '2027-01-09' }, now)).toBe('confirmed')
    expect(registrationDisplayStatus({ status: 'withdrawn', responseDueAt: '2027-01-09' }, now)).toBe('withdrawn')
  })

  it('compte par statut, dans l’ordre d’affichage, sans les statuts absents', () => {
    const counts = countRegistrationsByStatus([
      { status: 'confirmed' },
      { status: 'invited', responseDueAt: '2027-01-09' },
      { status: 'confirmed' },
      { status: 'invited', responseDueAt: '2027-01-20' }
    ], now)
    expect(counts.map(({ status, count, label }) => [status, count, label])).toEqual([
      ['invited', 1, 'Invitée'],
      ['overdue', 1, 'Délai dépassé'],
      ['confirmed', 2, 'Confirmée']
    ])
  })
})
