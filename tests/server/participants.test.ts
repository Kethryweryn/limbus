import { describe, expect, it, vi } from 'vitest'
import { prisma } from '~/server/utils/prisma'

// Retrait d'une personne de jeux (US-035) : rien n'est écrit hors de la transaction de l'appelant, pour qu'un échec
// de la mise à jour de la fiche ne laisse pas les jeux retirés (revue de code)
const deleteUnusedUploads = vi.hoisted(() => vi.fn(async () => {}))
vi.mock('~/server/utils/uploads', () => ({ deleteUnusedUploads }))
vi.mock('~/server/utils/trombinoscopes', () => ({ generateSessionTrombinoscopes: vi.fn() }))

const { planParticipantRemoval } = await import('~/server/utils/participants')

describe('planParticipantRemoval', () => {
  it('n’écrit que dans la transaction donnée, puis fait le ménage des fichiers après', async () => {
    const read = (rows: unknown[]) => ({ findMany: vi.fn(async () => rows) })
    Object.assign(prisma, {
      sessionParticipant: read([{ sessionId: 's1' }]),
      sessionAssignment: read([{ sessionId: 's1', photoUrl: '/api/uploads/session-assignment-photos/a.png' }]),
      timelineEventResponsible: read([]),
      sessionAttendance: read([]),
      sessionTrombinoscope: { groupBy: vi.fn(async () => []) }
    })
    const write = () => ({ deleteMany: vi.fn(), updateMany: vi.fn() })
    const tx = {
      participantGame: write(),
      sessionParticipant: write(),
      timelineEventResponsible: write(),
      sessionAssignment: write(),
      sessionAttendance: write(),
      registration: write(),
      registrationSession: write(),
      session: write()
    }

    const removal = await planParticipantRemoval('p1', ['g1'], { id: 'u1' })
    expect(tx.participantGame.deleteMany).not.toHaveBeenCalled()

    await removal.apply(tx as never)
    expect(tx.participantGame.deleteMany).toHaveBeenCalledWith({ where: { participantId: 'p1', gameId: { in: ['g1'] } } })
    expect(tx.session.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['s1'] } } }))
    expect(deleteUnusedUploads).not.toHaveBeenCalled()

    await removal.afterCommit()
    expect(deleteUnusedUploads).toHaveBeenCalledWith(['/api/uploads/session-assignment-photos/a.png'])
  })

  it('sans jeu retiré, ne lit ni n’écrit rien', async () => {
    const removal = await planParticipantRemoval('p1', [], { id: 'u1' })
    await removal.apply({} as never)
    await removal.afterCommit()
    expect(deleteUnusedUploads).not.toHaveBeenCalledWith([])
  })
})
