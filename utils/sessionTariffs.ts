// Tarifs, versements et état d'un paiement (US-031 à US-034, ADR-0032) : partagé entre le serveur et l'interface

export const TARIFF_ROLES = {
  pj: 'pj',
  pnj: 'pnj',
  organizer: 'organizer',
  kitchen: 'kitchen'
} as const

// Une personne qui a plusieurs rôles reçoit le tarif du premier qui en a un, dans cet ordre
export const TARIFF_ROLE_ORDER: string[] = [TARIFF_ROLES.pj, TARIFF_ROLES.pnj, TARIFF_ROLES.organizer, TARIFF_ROLES.kitchen]

export const TARIFF_ROLE_LABELS: Record<string, string> = {
  pj: 'PJ',
  pnj: 'PNJ',
  organizer: 'Orga',
  kitchen: 'Cuisine'
}

export const PAYMENT_STATES = {
  paid: 'paid',
  partial: 'partial',
  unpaid: 'unpaid',
  nothingDue: 'nothing_due'
} as const

export const PAYMENT_STATE_DISPLAY: Record<string, { label: string, color: 'success' | 'warning' | 'error' | 'neutral' }> = {
  paid: { label: 'Payé', color: 'success' },
  partial: { label: 'Partiel', color: 'warning' },
  unpaid: { label: 'Non payé', color: 'error' },
  nothing_due: { label: 'Rien à payer', color: 'neutral' }
}

export function formatEuros(cents: number) {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

export function eurosToCents(euros: number) {
  return Math.round(euros * 100)
}

type TariffLike = { id: string, name: string, amountCents: number, defaultRole: string | null, baseTariffId: string | null }

// Tarif d'une personne : celui choisi, sinon celui du premier de ses rôles qui a un tarif par défaut
export function tariffForPerson<T extends TariffLike>(roles: string[], tariffs: T[], chosenTariffId?: string | null) {
  if (chosenTariffId) {
    const chosen = tariffs.find((tariff) => tariff.id === chosenTariffId)
    if (chosen) return { tariff: chosen, chosen: true }
  }
  for (const role of TARIFF_ROLE_ORDER) {
    if (!roles.includes(role)) continue
    const tariff = tariffs.find((item) => item.defaultRole === role)
    if (tariff) return { tariff, chosen: false }
  }
  return { tariff: null, chosen: false }
}

// État calculé à la lecture (ADR-0032) ; un paiement validé en mode simple, sans versement, reste payé
export function paymentState(params: { dueCents: number, receivedCents: number, legacyPaid: boolean }) {
  if (params.dueCents <= 0) return PAYMENT_STATES.nothingDue
  if (params.receivedCents >= params.dueCents || (params.legacyPaid && params.receivedCents === 0)) return PAYMENT_STATES.paid
  if (params.receivedCents > 0) return PAYMENT_STATES.partial
  return PAYMENT_STATES.unpaid
}

/**
 * Places solidaires (US-033) : un tarif plus cher que sa base apporte la différence, un tarif moins cher la coûte.
 * L'apport encaissé est la part des versements d'un soutien au-delà de son tarif de base.
 */
export function solidarityBalance(rows: Array<{ tariff: TariffLike | null, receivedCents: number }>, tariffs: TariffLike[]) {
  let contributionAssigned = 0
  let contributionReceived = 0
  let reductionCost = 0
  for (const row of rows) {
    const base = row.tariff?.baseTariffId ? tariffs.find((tariff) => tariff.id === row.tariff!.baseTariffId) : null
    if (!row.tariff || !base) continue
    const difference = row.tariff.amountCents - base.amountCents
    if (difference > 0) {
      contributionAssigned += difference
      contributionReceived += Math.min(Math.max(row.receivedCents - base.amountCents, 0), difference)
    } else {
      reductionCost -= difference
    }
  }
  return {
    contributionAssigned,
    contributionReceived,
    reductionCost,
    balanceAssigned: contributionAssigned - reductionCost,
    balanceReceived: contributionReceived - reductionCost
  }
}

// Montants d'une demande ou d'une relance en mode tarifs (US-034) : la relance d'un paiement partiel rappelle le reste
export type PaymentAmounts = { tariffName: string, dueCents: number, receivedCents: number, remainingCents: number }

export function paymentAmountLines(amounts: PaymentAmounts | null | undefined) {
  if (!amounts) return []
  if (!amounts.receivedCents) return [`Montant : ${formatEuros(amounts.dueCents)} (tarif ${amounts.tariffName}).`]
  return [
    `Montant dû : ${formatEuros(amounts.dueCents)} (tarif ${amounts.tariffName}).`,
    `Déjà reçu : ${formatEuros(amounts.receivedCents)}.`,
    `Reste à payer : ${formatEuros(amounts.remainingCents)}.`
  ]
}
