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
  gameId: 'g1',
  state: 'closed',
  updatedAt: '2026-11-02T10:00:00.000Z'
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

    expect(actionMock).toHaveBeenCalledWith('/api/registrations/r1/remind', { method: 'POST', body: { sessionId: null } })
    expect(fetchByUrlMock).toHaveBeenCalledWith('/api/registration-periods?gameId=g1', { offlineCache: true })
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

  it('une relance pour une session vise cette session', async () => {
    const actions = provideRegistrationPeriodActions(() => 'g1')
    await actions.remind(registration as never, 's1')

    expect(actionMock).toHaveBeenCalledWith('/api/registrations/r1/remind', { method: 'POST', body: { sessionId: 's1' } })
  })

  it('ouvrir le vivier n’envoie que son état et sa version', async () => {
    const actions = provideRegistrationPeriodActions(() => 'g1')
    await actions.setState(period as never, 'open')

    expect(actionMock).toHaveBeenCalledWith('/api/registration-periods/per1', {
      method: 'PUT',
      body: { gameId: 'g1', state: 'open', updatedAt: '2026-11-02T10:00:00.000Z' }
    })
  })

  it('une modification du vivier refusée s’affiche sans relire', async () => {
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
