import { describe, expect, it } from 'vitest'
import { isBackInPool } from '~/utils/registrations'
import { selectionAnnouncementEmail } from '~/server/utils/registrations'

const base = { participantName: 'Lou', gameTitle: 'Le Bal', url: 'https://limbus.test/inscription/x' }
const session = { name: 'Printemps', date: new Date('2027-04-10T10:00:00Z') }

describe('selectionAnnouncementEmail (US-088)', () => {
  it('une place retenue donne la session, l’échéance et le lien', () => {
    const email = selectionAnnouncementEmail({ ...base, status: 'retained', sessions: [session], responseDueAt: new Date('2027-03-01T10:00:00Z') })
    expect(email.subject).toBe('Place retenue : Le Bal')
    expect(email.text).toContain('session Printemps (10 avril 2027)')
    expect(email.text).toContain('avant le 1 mars 2027')
    expect(email.text).toContain(base.url)
  })

  it('la liste d’attente nomme les sessions, sans rang', () => {
    const email = selectionAnnouncementEmail({ ...base, status: 'waitlisted', sessions: [session, { name: 'Été', date: null }], responseDueAt: null })
    expect(email.text).toContain('les sessions Printemps (10 avril 2027), Été')
    expect(email.text).not.toMatch(/\d+e sur/)
  })

  it('une inscription non retenue est prévenue', () => {
    expect(selectionAnnouncementEmail({ ...base, status: 'rejected', sessions: [], responseDueAt: null }).text).toContain('n’a pas été retenue')
  })
})

describe('isBackInPool (ADR-0047)', () => {
  it('une place dans une session terminée ou annulée remet la personne dans le vivier', () => {
    expect(isBackInPool({ status: 'confirmed', session: { status: 'completed' } })).toBe(true)
    expect(isBackInPool({ status: 'retained', session: { status: 'cancelled' } })).toBe(true)
    expect(isBackInPool({ status: 'confirmed', session: { status: 'scheduled' } })).toBe(false)
    expect(isBackInPool({ status: 'withdrawn', session: { status: 'completed' } })).toBe(false)
  })
})
