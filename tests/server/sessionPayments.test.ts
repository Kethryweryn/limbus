import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendEmail } from '~/server/utils/email'
import { readUpload } from '~/server/utils/uploads'
import { prisma } from '~/server/utils/prisma'
import { sendSessionPaymentEmails } from '~/server/utils/sessionPayments'

vi.mock('~/server/utils/email', () => ({ sendEmail: vi.fn() }))
vi.mock('~/server/utils/uploads', () => ({ readUpload: vi.fn() }))

const RIB_URL = '/api/uploads/session-payment-ribs/c3027e5d-2f9b-4619-8603-f8749c135cc3.pdf'

function sessionWith(paymentRibUrl: string | null) {
  return {
    id: 'session-1',
    name: 'Session 1',
    date: null,
    paymentRibUrl,
    paymentLinkUrl: null,
    game: { title: 'Jeu' },
    payments: [],
    participants: [],
    assignments: [{
      participantId: 'p1',
      participant: { id: 'p1', name: 'Camille Martin', email: 'camille@example.test' },
      character: { name: 'Rôle', type: 'pj' }
    }]
  }
}

beforeEach(() => {
  vi.mocked(sendEmail).mockReset().mockResolvedValue({ sent: true } as never)
  vi.mocked(readUpload).mockReset()
  Object.assign(prisma, { sessionPayment: { upsert: vi.fn() } })
})

describe('sendSessionPaymentEmails', () => {
  it('joint le RIB téléversé au lieu d’un lien que le participant ne pourrait pas ouvrir', async () => {
    Object.assign(prisma, { session: { findUnique: vi.fn().mockResolvedValue(sessionWith(RIB_URL)) } })
    vi.mocked(readUpload).mockResolvedValue(Buffer.from('%PDF-1.4'))

    await expect(sendSessionPaymentEmails('session-1')).resolves.toEqual({ sentCount: 1, skippedCount: 0 })

    const message = vi.mocked(sendEmail).mock.calls[0]![0]
    expect(message.attachments).toEqual([{ filename: 'RIB.pdf', content: Buffer.from('%PDF-1.4'), contentType: 'application/pdf' }])
    expect(message.text).toContain('Le RIB est joint')
    expect(message.text).not.toContain('/api/uploads')
  })

  it('garde le lien quand le RIB est une URL externe', async () => {
    Object.assign(prisma, { session: { findUnique: vi.fn().mockResolvedValue(sessionWith('https://banque.example/rib.pdf')) } })
    vi.mocked(readUpload).mockResolvedValue(null)

    await sendSessionPaymentEmails('session-1')

    const message = vi.mocked(sendEmail).mock.calls[0]![0]
    expect(message.attachments).toEqual([])
    expect(message.text).toContain('RIB : https://banque.example/rib.pdf')
  })
})
