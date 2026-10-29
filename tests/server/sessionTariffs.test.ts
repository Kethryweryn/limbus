import { describe, expect, it } from 'vitest'
import { buildTariffPaymentRows } from '~/server/utils/sessionPayments'
import { paymentAmountLines, paymentState, solidarityBalance, tariffForPerson } from '~/utils/sessionTariffs'

const tariff = (id: string, amountCents: number, defaultRole: string | null = null, baseTariffId: string | null = null) =>
  ({ id, name: id, amountCents, defaultRole, baseTariffId })
const person = (id: string) => ({ id, name: id, email: `${id}@example.test` })
const payment = (participantId: string, extra: Record<string, unknown> = {}) => ({
  participantId, paidAt: null, paymentEmailSentAt: null, paymentReminderSentAt: null, tariffId: null, instalments: [], ...extra
})

describe('tarif d’une personne (US-031)', () => {
  const tariffs = [tariff('pj', 8000, 'pj'), tariff('pnj', 3000, 'pnj'), tariff('reduit', 5000)]

  it('prend le tarif du premier de ses rôles qui en a un, ou celui choisi', () => {
    expect(tariffForPerson(['pj', 'organizer'], tariffs).tariff?.id).toBe('pj')
    expect(tariffForPerson(['organizer', 'kitchen'], tariffs).tariff).toBeNull()
    expect(tariffForPerson(['pnj'], tariffs, 'reduit')).toMatchObject({ tariff: { id: 'reduit' }, chosen: true })
  })

  it('met toute l’équipe dans le tableau, avec le tarif de son rôle', () => {
    const [lea, noe, sam, ana] = ['lea', 'noe', 'sam', 'ana'].map(person)
    const rows = buildTariffPaymentRows(
      [
        { participantId: 'lea', participant: lea!, character: { name: 'Aube', type: 'pj' } },
        { participantId: 'noe', participant: noe!, character: { name: 'Garde', type: 'pnj' } }
      ],
      [
        { role: 'organizer', participant: sam! },
        { role: 'kitchen', participant: ana! },
        { role: 'participant', participant: noe! }
      ],
      [payment('ana', { tariffId: 'reduit' })],
      tariffs
    )
    expect(rows.map((row) => [row.participant.id, row.tariff?.id ?? null, row.dueCents, row.state])).toEqual([
      ['lea', 'pj', 8000, 'unpaid'],
      ['noe', 'pnj', 3000, 'unpaid'],
      ['ana', 'reduit', 5000, 'unpaid'],
      ['sam', null, 0, 'nothing_due']
    ])
  })
})

describe('état d’un paiement (US-032)', () => {
  it('se calcule à partir du dû et des versements', () => {
    expect(paymentState({ dueCents: 8000, receivedCents: 8000, legacyPaid: false })).toBe('paid')
    expect(paymentState({ dueCents: 8000, receivedCents: 3000, legacyPaid: false })).toBe('partial')
    expect(paymentState({ dueCents: 8000, receivedCents: 0, legacyPaid: false })).toBe('unpaid')
    expect(paymentState({ dueCents: 0, receivedCents: 0, legacyPaid: false })).toBe('nothing_due')
  })

  it('un paiement validé en mode simple, sans versement, reste payé', () => {
    expect(paymentState({ dueCents: 8000, receivedCents: 0, legacyPaid: true })).toBe('paid')
  })

  it('additionne les versements et calcule le reste', () => {
    const rows = buildTariffPaymentRows(
      [{ participantId: 'lea', participant: person('lea'), character: { name: 'Aube', type: 'pj' } }],
      [],
      [payment('lea', { instalments: [{ id: 'v1', amountCents: 3000, receivedAt: new Date() }, { id: 'v2', amountCents: 2000, receivedAt: new Date() }] })],
      [tariff('pj', 8000, 'pj')]
    )
    expect(rows[0]).toMatchObject({ receivedCents: 5000, remainingCents: 3000, state: 'partial' })
  })
})

describe('places solidaires (US-033)', () => {
  it('calcule l’apport des soutiens, le coût des réductions et les soldes', () => {
    const pj = tariff('pj', 8000, 'pj')
    const support = tariff('soutien', 12000, null, 'pj')
    const reduced = tariff('reduit', 5000, null, 'pj')
    const balance = solidarityBalance([
      { tariff: support, receivedCents: 10000 },
      { tariff: support, receivedCents: 0 },
      { tariff: reduced, receivedCents: 5000 },
      { tariff: pj, receivedCents: 8000 }
    ], [pj, support, reduced])
    expect(balance).toEqual({
      contributionAssigned: 8000,
      contributionReceived: 2000,
      reductionCost: 3000,
      balanceAssigned: 5000,
      balanceReceived: -1000
    })
  })
})

describe('montants des emails de paiement (US-034)', () => {
  it('donne le montant, puis le dû, le reçu et le reste après un versement', () => {
    expect(paymentAmountLines({ tariffName: 'PJ', dueCents: 8000, receivedCents: 0, remainingCents: 8000 }).join(' ')).toMatch(/Montant : 80,00\s€ \(tarif PJ\)/)
    const partial = paymentAmountLines({ tariffName: 'PJ', dueCents: 8000, receivedCents: 3000, remainingCents: 5000 }).join(' ')
    expect(partial).toMatch(/Déjà reçu : 30,00\s€/)
    expect(partial).toMatch(/Reste à payer : 50,00\s€/)
    expect(paymentAmountLines(null)).toEqual([])
  })
})

