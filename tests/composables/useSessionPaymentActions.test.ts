import { describe, expect, it, vi } from 'vitest'

// Écritures de l'onglet Paiements (US-116) : la version lue de la ligne et le nom de la personne partent avec chacune
const fetchMock = vi.hoisted(() => vi.fn(async () => ({})))
vi.mock('vue', async (importOriginal) => ({ ...await importOriginal<typeof import('vue')>(), provide: vi.fn() }))
vi.mock('~/composables/useApiFetch', () => ({ useApiFetch: fetchMock, useApiAction: fetchMock }))

const { provideSessionPaymentActions } = await import('~/composables/useSessionPaymentActions')
const { NO_VERSION } = await import('~/utils/offlineSync')

const data = {
  session: { id: 's1', name: 'Samedi', paymentSettingsUpdatedAt: null },
  rows: [],
  tariffs: [],
  mode: 'simple'
}

describe('écritures des paiements', () => {
  it('une ligne envoie sa version et le nom de la personne, puis relit l’onglet', async () => {
    const refresh = vi.fn(async () => {})
    const actions = provideSessionPaymentActions(() => data as never, refresh)

    const done = actions.writeRow({ participant: { id: 'p1', name: 'Léa' }, paymentUpdatedAt: '2026-11-02T10:00:00.000Z' }, '/offered', { offered: true })
    expect(actions.updatingParticipantId.value).toBe('p1')
    expect(await done).toBe(true)

    expect(fetchMock).toHaveBeenCalledWith('/api/sessions/s1/payments/p1/offered', {
      method: 'PUT',
      body: { offered: true, updatedAt: '2026-11-02T10:00:00.000Z' },
      offlineLabel: 'Léa'
    })
    expect(refresh).toHaveBeenCalled()
    expect(actions.updatingParticipantId.value).toBe('')
  })

  it('une ligne jamais enregistrée envoie la version « aucune » ; un refus s’affiche sans relire', async () => {
    const refresh = vi.fn(async () => {})
    const actions = provideSessionPaymentActions(() => data as never, refresh)
    fetchMock.mockRejectedValueOnce(Object.assign(new Error('x'), { data: { message: 'Modifiée entre-temps' } }))

    expect(await actions.writePayment({ participant: { id: 'p2', name: 'Noé' } }, '', { paid: true })).toBe(false)
    expect(fetchMock).toHaveBeenLastCalledWith('/api/sessions/s1/payments/p2', expect.objectContaining({ body: { paid: true, updatedAt: NO_VERSION } }))
    expect(actions.serverError.value).toBe('Modifiée entre-temps')
    expect(refresh).not.toHaveBeenCalled()
  })
})
