import { describe, expect, it } from 'vitest'
import { attendanceDisplayStatus, attendanceInvitationEmailText, canAnswerAttendance, canReleaseAttendance } from '~/utils/attendance'

const now = new Date('2026-11-10T12:00:00.000Z')
const before = new Date('2026-11-09T12:00:00.000Z')
const after = new Date('2026-11-11T12:00:00.000Z')

describe('confirmation de présence (US-024)', () => {
  it('signale le délai dépassé à la lecture, seulement sans réponse', () => {
    expect(attendanceDisplayStatus({ status: 'pending', responseDueAt: before }, now)).toBe('overdue')
    expect(attendanceDisplayStatus({ status: 'pending', responseDueAt: after }, now)).toBe('pending')
    expect(attendanceDisplayStatus({ status: 'confirmed', responseDueAt: before }, now)).toBe('confirmed')
  })

  it('laisse répondre tant que la place n’est pas libérée, et changer d’avis jusqu’à la date limite', () => {
    expect(canAnswerAttendance({ status: 'pending', responseDueAt: before }, now)).toBe(true)
    expect(canAnswerAttendance({ status: 'confirmed', responseDueAt: after }, now)).toBe(true)
    expect(canAnswerAttendance({ status: 'confirmed', responseDueAt: before }, now)).toBe(false)
    expect(canAnswerAttendance({ status: 'released', responseDueAt: after }, now)).toBe(false)
  })

  it('libère la place d’une personne qui ne viendra pas ou n’a pas répondu à temps', () => {
    expect(canReleaseAttendance({ status: 'declined', responseDueAt: after }, now)).toBe(true)
    expect(canReleaseAttendance({ status: 'pending', responseDueAt: before }, now)).toBe(true)
    expect(canReleaseAttendance({ status: 'pending', responseDueAt: after }, now)).toBe(false)
    expect(canReleaseAttendance({ status: 'confirmed', responseDueAt: before }, now)).toBe(false)
  })

  it('l’email contient le lien personnel, la session d’origine et la date limite', () => {
    const text = attendanceInvitationEmailText({
      participantName: 'Léa',
      gameTitle: 'Les Brumes',
      previousSessionName: 'Printemps',
      sessionName: 'Automne',
      sessionDate: after,
      locationName: 'Château',
      responseDueAt: after,
      url: 'https://limbus.test/presence/abc'
    })
    expect(text).toContain('https://limbus.test/presence/abc')
    expect(text).toContain('« Printemps »')
    expect(text).toContain('11 novembre 2026')
  })
})
