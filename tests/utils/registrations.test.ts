import { describe, expect, it } from 'vitest'
import {
  canConfirmPlace,
  isAnnouncementPending,
  isResponseOverdue,
  registrationDisplayStatus,
  registrationStatusMeta,
  splitParticipantName,
  visibleLineStatus
} from '~/utils/registrations'

const now = new Date('2027-01-10T12:00:00Z')

describe('isResponseOverdue (R20)', () => {
  it('une invitation sans réponse dont l’échéance est passée', () => {
    expect(isResponseOverdue({ status: 'invited', responseDueAt: '2027-01-10T11:59:00Z' }, now)).toBe(true)
    expect(isResponseOverdue({ status: 'invited', responseDueAt: '2027-01-10T12:01:00Z' }, now)).toBe(false)
  })

  it('jamais pour une personne qui a répondu, ni sans échéance', () => {
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

describe('décisions à annoncer pour une session (US-088, ADR-0047)', () => {
  it('une décision de sélection qui diffère de l’annonce est à annoncer', () => {
    expect(isAnnouncementPending({ status: 'retained', announcedStatus: null })).toBe(true)
    expect(isAnnouncementPending({ status: 'retained', announcedStatus: 'waitlisted' })).toBe(true)
    expect(isAnnouncementPending({ status: 'retained', announcedStatus: 'retained' })).toBe(false)
    expect(isAnnouncementPending({ status: 'waitlisted', announcedStatus: 'waitlisted' })).toBe(false)
    // Pré-inscrite, inscrite ou en annulation : rien à annoncer
    expect(isAnnouncementPending({ status: 'preregistered', announcedStatus: 'waitlisted' })).toBe(false)
    expect(isAnnouncementPending({ status: 'confirmed', announcedStatus: 'retained' })).toBe(false)
    expect(isAnnouncementPending({ status: 'cancelled', announcedStatus: null })).toBe(false)
  })

  it('une place se confirme seulement retenue et annoncée (US-089)', () => {
    expect(canConfirmPlace({ status: 'retained', announcedStatus: 'retained' })).toBe(true)
    expect(canConfirmPlace({ status: 'retained', announcedStatus: null })).toBe(false)
    expect(canConfirmPlace({ status: 'retained', announcedStatus: 'waitlisted' })).toBe(false)
    expect(canConfirmPlace({ status: 'confirmed', announcedStatus: 'retained' })).toBe(false)
  })
})

describe('ce que voit la personne pour une session (R28)', () => {
  it('une décision pas encore annoncée ne se voit pas : la dernière annonce, sinon sa dernière réponse', () => {
    expect(visibleLineStatus({ status: 'retained', announcedStatus: null, answer: 'available' })).toBe('preregistered')
    expect(visibleLineStatus({ status: 'retained', announcedStatus: null, answer: 'unavailable' })).toBe('unavailable')
    expect(visibleLineStatus({ status: 'retained', announcedStatus: 'waitlisted', answer: 'available' })).toBe('waitlisted')
    expect(visibleLineStatus({ status: 'waitlisted', announcedStatus: 'retained', answer: 'available' })).toBe('retained')
  })

  it('ajoutée à la main sans avoir répondu ni reçu d’annonce : elle ne voit rien', () => {
    expect(visibleLineStatus({ status: 'retained', announcedStatus: null, answer: null })).toBeNull()
    expect(visibleLineStatus({ status: 'cancelled', announcedStatus: null, answer: null, cancelledById: 'orga' })).toBeNull()
  })

  it('une annulation par l’équipe sans annonce ne se voit pas ; la sienne, si', () => {
    expect(visibleLineStatus({ status: 'cancelled', announcedStatus: null, answer: 'available', cancelledById: 'orga' })).toBe('preregistered')
    expect(visibleLineStatus({ status: 'cancelled', announcedStatus: 'retained', answer: 'available', cancelledById: 'orga' })).toBe('cancelled')
    expect(visibleLineStatus({ status: 'cancelled', announcedStatus: null, answer: 'available', cancelledById: null })).toBe('cancelled')
  })

  it('ses propres réponses et sa confirmation se voient telles quelles', () => {
    expect(visibleLineStatus({ status: 'preregistered', answer: 'available' })).toBe('preregistered')
    expect(visibleLineStatus({ status: 'unavailable', answer: 'unavailable' })).toBe('unavailable')
    expect(visibleLineStatus({ status: 'confirmed', announcedStatus: 'retained' })).toBe('confirmed')
    expect(visibleLineStatus({ status: 'transferred', announcedStatus: 'retained' })).toBe('transferred')
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

  it('les statuts du jeu et d’une session ont leur libellé ; un statut inconnu s’affiche tel quel', () => {
    expect(registrationStatusMeta({ status: 'invited', responseDueAt: '2020-01-01T00:00:00Z' }).label).toBe('Délai dépassé')
    expect(registrationStatusMeta({ status: 'received' }).label).toBe('Intéressée')
    expect(registrationStatusMeta({ status: 'retained' }).label).toBe('Castée')
    expect(registrationStatusMeta({ status: 'confirmed' }).label).toBe('Inscrite')
    expect(registrationStatusMeta({ status: 'cancelled' }).label).toBe('Annulation')
    expect(registrationStatusMeta({ status: 'inconnu' })).toEqual({ label: 'inconnu', color: 'neutral' })
  })
})
