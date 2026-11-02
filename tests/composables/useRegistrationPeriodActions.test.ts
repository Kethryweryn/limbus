import { beforeEach, describe, expect, it, vi } from 'vitest'

// Actions du bloc d'un jeu sur la page Inscriptions (US-117) : chaque action relit les périodes
const actionMock = vi.hoisted(() => vi.fn(async (): Promise<unknown> => ({})))
const fetchByUrlMock = vi.hoisted(() => vi.fn(async (): Promise<unknown> => []))
vi.mock('vue', async (importOriginal) => ({ ...await importOriginal<typeof import('vue')>(), provide: vi.fn() }))
vi.mock('~/composables/useApiFetch', () => ({ useApiAction: actionMock, fetchByUrl: fetchByUrlMock }))

const { provideRegistrationPeriodActions } = await import('~/composables/useRegistrationPeriodActions')

const registration = { id: 'r1', status: 'invited', participant: { id: 'p1', name: 'Léa' } }
const period = {
  id: 'per1',
  name: 'Printemps',
  gameId: 'g1',
  state: 'closed',
  closesAt: '2020-01-01T00:00:00.000Z',
  responseDelayDays: 7,
  updatedAt: '2026-11-02T10:00:00.000Z',
  sessions: [{ sessionId: 's1', seats: 10 }]
}

beforeEach(() => {
  actionMock.mockClear()
  fetchByUrlMock.mockClear()
  vi.stubGlobal('confirm', () => true)
})

describe('actions du bloc d’un jeu', () => {
  it('une relance passe par l’action de l’inscription, puis relit les périodes du jeu', async () => {
    const actions = provideRegistrationPeriodActions(() => 'g1')
    await actions.remind(registration as never)

    expect(actionMock).toHaveBeenCalledWith('/api/registrations/r1/remind', { method: 'POST' })
    expect(fetchByUrlMock).toHaveBeenCalledWith('/api/registration-periods?gameId=g1')
    expect(actions.infoMessage.value).toBe('Rappel envoyé à Léa.')
  })

  it('un renvoi refusé relit tout de même : l’ancien lien a pu être invalidé', async () => {
    const actions = provideRegistrationPeriodActions(() => 'g1')
    actionMock.mockRejectedValueOnce(Object.assign(new Error('x'), { data: { message: 'Envoi impossible' } }))
    await actions.resend(registration as never)

    expect(fetchByUrlMock).toHaveBeenCalled()
    expect(actions.errorMessage.value).toBe('Envoi impossible')
    expect(actions.infoMessage.value).toBe('')
  })

  it('rouvrir une période dont la clôture est passée retire la date', async () => {
    const actions = provideRegistrationPeriodActions(() => 'g1')
    await actions.reopen(period as never)

    expect(actionMock).toHaveBeenCalledWith('/api/registration-periods/per1', {
      method: 'PUT',
      body: {
        name: 'Printemps',
        gameId: 'g1',
        closesAt: null,
        responseDelayDays: 7,
        sessions: [{ sessionId: 's1', seats: 10 }],
        updatedAt: '2026-11-02T10:00:00.000Z',
        state: 'open'
      }
    })
  })

  it('une modification de période refusée s’affiche sans relire', async () => {
    const actions = provideRegistrationPeriodActions(() => 'g1')
    actionMock.mockRejectedValueOnce(Object.assign(new Error('x'), { data: { message: 'Modifiée entre-temps' } }))
    await actions.setState(period as never, 'open')

    expect(actions.errorMessage.value).toBe('Modifiée entre-temps')
    expect(fetchByUrlMock).not.toHaveBeenCalled()
  })

  it('les invitations non envoyées s’affichent en avertissement', async () => {
    const actions = provideRegistrationPeriodActions(() => 'g1')
    await actions.invited({ invitedCount: 2, sentCount: 1, failures: [{ participantName: 'Noé', message: 'adresse refusée' }] } as never)

    expect(actions.infoColor.value).toBe('warning')
    expect(actions.infoMessage.value).toBe('2 invitations, 1 email envoyé. Non envoyés : Noé (adresse refusée). Utilisez « Envoyer » une fois le problème réglé.')
  })
})
