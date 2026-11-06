import { describe, expect, it, vi } from 'vitest'
import { prisma } from '~/server/utils/prisma'
import { announceSelection } from '~/server/utils/registrationSelection'

const send = vi.hoisted(() => vi.fn())
vi.mock('~/server/utils/email', () => ({ openEmailTransport: async () => ({ send, close: () => {} }), sendEmail: vi.fn() }))

describe('annonce en plusieurs emails (US-088)', () => {
  it('un email parti garde un lien valable, et ce qui n’est pas parti reste à annoncer', async () => {
    send.mockReset()
    send.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Adresse refusée'))
    const updateRegistration = vi.fn()
    const updateLines = vi.fn()
    Object.assign(prisma, {
      registrationPeriod: { findUnique: vi.fn().mockResolvedValue({ id: 'v1', responseDelayDays: 7, game: { title: 'Le Bal' } }) },
      registration: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'r1',
          email: 'lou@example.test',
          participant: { name: 'Lou' },
          sessionLines: [
            { id: 'l1', status: 'retained', announcedStatus: null, session: { name: 'Printemps', date: null } },
            { id: 'l2', status: 'retained', announcedStatus: null, session: { name: 'Été', date: null } }
          ]
        }])
      },
      $transaction: async (run: (tx: unknown) => Promise<void>) => await run({ registration: { update: updateRegistration }, registrationSession: { updateMany: updateLines } })
    })

    const result = await announceSelection('v1')

    expect(send).toHaveBeenCalledTimes(2)
    expect(updateRegistration).toHaveBeenCalledTimes(1)
    expect(updateLines).toHaveBeenCalledTimes(1)
    expect(updateLines.mock.calls[0]![0].where).toEqual({ id: 'l1', status: 'retained' })
    expect(result).toEqual({ announcedCount: 0, failures: [{ participantName: 'Lou', message: 'Adresse refusée' }] })
  })
})
