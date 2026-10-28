import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendEmail } from '~/server/utils/email'
import { readUpload } from '~/server/utils/uploads'
import { prisma } from '~/server/utils/prisma'
import { buildPaymentRows, sendSessionPaymentEmails } from '~/server/utils/sessionPayments'

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

describe('lignes du tableau des paiements (US-007, R22)', () => {
  const person = (id: string, name: string) => ({ id, name, email: `${id}@example.test` })
  const zoe = person('zoe', 'Zoé')
  const hugo = person('hugo', 'Hugo')
  const ines = person('ines', 'Inès')
  const cook = person('cook', 'Cuisinier')
  const orga = person('orga', 'Orga')
  const assignment = (participant: ReturnType<typeof person> | null, name: string, type = 'pj') => ({
    participantId: participant?.id ?? null,
    participant,
    character: { name, type }
  })

  it('les personnes avec personnage (PJ ou PNJ), puis les inscrits confirmés « personnage à attribuer »', () => {
    const rows = buildPaymentRows(
      [assignment(zoe, 'Brume'), assignment(hugo, 'Aube', 'pnj'), assignment(null, 'Cendre'), assignment(orga, 'Décor', 'orga')],
      [{ role: 'participant', participant: ines }, { role: 'kitchen', participant: cook }, { role: 'organizer', participant: orga }],
      []
    )
    expect(rows.map((row) => [row.participant.id, row.character?.name ?? null])).toEqual([
      ['hugo', 'Aube'],
      ['zoe', 'Brume'],
      ['ines', null]
    ])
  })

  it('une personne n’apparaît qu’une fois, avec tous ses personnages', () => {
    const rows = buildPaymentRows(
      [assignment(zoe, 'Brume'), assignment(zoe, 'Aube', 'pnj')],
      [{ role: 'participant', participant: zoe }],
      []
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]!.characters.map((character) => character.name)).toEqual(['Aube', 'Brume'])
  })

  it('reprend le paiement de chaque personne', () => {
    const paidAt = new Date('2027-01-01')
    const rows = buildPaymentRows([], [{ role: 'participant', participant: ines }], [
      { participantId: 'ines', paidAt, paymentEmailSentAt: null, paymentReminderSentAt: null }
    ])
    expect(rows[0]).toMatchObject({ participant: ines, character: null, paidAt })
  })

  it('envoie l’email de paiement à une personne sans personnage', async () => {
    Object.assign(prisma, {
      session: {
        findUnique: vi.fn().mockResolvedValue({
          ...sessionWith(null),
          assignments: [],
          participants: [{ role: 'participant', participant: { id: 'p2', name: 'Inès Roy', email: 'ines@example.test' } }]
        })
      }
    })
    vi.mocked(readUpload).mockResolvedValue(null)

    await expect(sendSessionPaymentEmails('session-1')).resolves.toEqual({ sentCount: 1, skippedCount: 0 })
    const message = vi.mocked(sendEmail).mock.calls[0]![0]
    expect(message.to).toBe('ines@example.test')
    expect(message.text).toContain('Bonjour Inès')
  })
})
