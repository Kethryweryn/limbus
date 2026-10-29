import { describe, expect, it } from 'vitest'
import { projectOfflineSession, projectOfflineTimeline } from '~/utils/sessionOffline'

const lea = { id: 'p1', name: 'Léa' }
const noe = { id: 'p2', name: 'Noé' }
const aube = { id: 'c1', name: 'Aube' }
const session = {
  id: 's1',
  name: 'Samedi',
  updatedAt: '2026-10-30T10:00:00.000Z',
  location: null,
  participants: [{ participantId: 'p1', role: 'participant', participant: lea }],
  assignments: [{ characterId: 'c1', participantId: null, participant: null, character: aube, photoUrl: null, notes: null }]
}

describe('session modifiée hors ligne (US-048)', () => {
  it('affiche le casting et l’équipe avec les personnes de l’appareil, en gardant la version lue', () => {
    const projected = projectOfflineSession(session, {
      name: 'Dimanche',
      locationId: 'l1',
      participants: [{ participantId: 'p1', role: 'participant' }, { participantId: 'p2', role: 'npc' }],
      assignments: [{ characterId: 'c1', participantId: 'p1', photoUrl: '', notes: 'Arrive tard' }]
    }, { participants: [lea, noe], characters: [aube], locations: [{ id: 'l1', name: 'Forêt' }] })

    expect(projected).toMatchObject({
      name: 'Dimanche',
      updatedAt: session.updatedAt,
      location: { name: 'Forêt' },
      participants: [{ participant: lea }, { participant: noe, role: 'npc' }],
      assignments: [{ character: aube, participant: lea, notes: 'Arrive tard', photoUrl: null }]
    })
  })

  it('une personne absente de l’appareil garde un nom neutre', () => {
    const projected = projectOfflineSession(session, { participants: [{ participantId: 'p9', role: 'npc' }] }, {})
    expect(projected.participants[0].participant).toEqual({ id: 'p9', name: 'Participant' })
  })

  it('remplace les responsables du déroulé', () => {
    const timeline = {
      session: { id: 's1', participants: [{ participant: lea }] },
      events: [{ id: 'e1', responsibles: [] }, { id: 'e2', responsibles: [{ participantId: 'p1', participant: lea }] }]
    }
    const projected = projectOfflineTimeline(timeline, [{ timelineEventId: 'e1', participantIds: ['p1'] }], {})
    expect(projected.events.map((event: any) => event.responsibles.map((item: any) => item.participant.name))).toEqual([['Léa'], []])
  })
})
