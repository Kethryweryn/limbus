// US-184 : la nouvelle version se charge au prochain changement de page (ADR-0071)
// US-196 : un changement de page la fait chercher, une fois par minute au plus (ADR-0078)
import { describe, expect, it, vi } from 'vitest'
import { checkForNewVersion, loadNewVersionAfterNavigation, PWA_UPDATE_CHECK_MS, PWA_UPDATE_FALLBACK_MS } from '~/utils/pwaUpdate'

function setup(needRefresh: boolean, reachable = true, update = async () => {}) {
  const pwa = { needRefresh, updateServiceWorker: vi.fn(update) }
  const timers: Array<{ callback: () => void, delay: number }> = []
  const browser = { reachable, reload: vi.fn(), setTimeout: (callback: () => void, delay: number) => timers.push({ callback, delay }) }
  return { pwa, browser, timers }
}

describe('nouvelle version au changement de page', () => {
  it('sans nouvelle version, ne fait rien', () => {
    const { pwa, browser } = setup(false)
    expect(loadNewVersionAfterNavigation(pwa, '/participants', '/', browser)).toBe(false)
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled()
    expect(loadNewVersionAfterNavigation(undefined, '/participants', '/', browser)).toBe(false)
  })

  it('avec une nouvelle version, active le service worker, et recharge quand même s’il ne prend pas la main', () => {
    const { pwa, browser, timers } = setup(true)
    expect(loadNewVersionAfterNavigation(pwa, '/participants', '/', browser)).toBe(true)
    expect(pwa.updateServiceWorker).toHaveBeenCalled()
    expect(browser.reload).not.toHaveBeenCalled()
    expect(timers).toHaveLength(1)
    expect(timers[0]!.delay).toBe(PWA_UPDATE_FALLBACK_MS)
    timers[0]!.callback()
    expect(browser.reload).toHaveBeenCalled()
  })

  it('un échec d’activation ne remonte pas', async () => {
    const { pwa, browser, timers } = setup(true, true, async () => { throw new Error('refus') })
    expect(loadNewVersionAfterNavigation(pwa, '/participants', '/', browser)).toBe(true)
    await Promise.resolve()
    expect(timers).toHaveLength(1)
  })

  it('hors ligne, serveur indisponible ou même page (requête seule), ne recharge rien', () => {
    const unreachable = setup(true, false)
    expect(loadNewVersionAfterNavigation(unreachable.pwa, '/participants', '/', unreachable.browser)).toBe(false)
    const same = setup(true)
    expect(loadNewVersionAfterNavigation(same.pwa, '/sessions/a', '/sessions/a', same.browser)).toBe(false)
    expect(unreachable.pwa.updateServiceWorker).not.toHaveBeenCalled()
    expect(same.pwa.updateServiceWorker).not.toHaveBeenCalled()
  })
})

describe('recherche d’une nouvelle version au changement de page', () => {
  const registration = (installing: unknown = null, update = async () => {}) => ({ installing, update: vi.fn(update) })

  it('cherche une fois par minute au plus', () => {
    const r = registration()
    const first = checkForNewVersion(r, true, 1_000_000, Number.NEGATIVE_INFINITY)
    expect(first).toBe(1_000_000)
    expect(checkForNewVersion(r, true, first + PWA_UPDATE_CHECK_MS - 1, first)).toBe(first)
    expect(r.update).toHaveBeenCalledTimes(1)
    expect(checkForNewVersion(r, true, first + PWA_UPDATE_CHECK_MS, first)).toBe(first + PWA_UPDATE_CHECK_MS)
    expect(r.update).toHaveBeenCalledTimes(2)
  })

  it('ne cherche pas hors ligne, sans service worker, ni pendant un téléchargement', () => {
    const r = registration()
    expect(checkForNewVersion(r, false, 1_000_000, Number.NEGATIVE_INFINITY)).toBe(Number.NEGATIVE_INFINITY)
    expect(checkForNewVersion(undefined, true, 1_000_000, Number.NEGATIVE_INFINITY)).toBe(Number.NEGATIVE_INFINITY)
    const installing = registration({})
    expect(checkForNewVersion(installing, true, 1_000_000, Number.NEGATIVE_INFINITY)).toBe(Number.NEGATIVE_INFINITY)
    expect(r.update).not.toHaveBeenCalled()
    expect(installing.update).not.toHaveBeenCalled()
  })

  it('un échec de la recherche ne remonte pas', async () => {
    const r = registration(null, async () => { throw new Error('réseau') })
    expect(checkForNewVersion(r, true, 1_000_000, Number.NEGATIVE_INFINITY)).toBe(1_000_000)
    await Promise.resolve()
  })
})
