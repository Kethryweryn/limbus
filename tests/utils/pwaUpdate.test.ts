// US-184 : la nouvelle version se charge au prochain changement de page (ADR-0071)
import { describe, expect, it, vi } from 'vitest'
import { loadNewVersionAfterNavigation, PWA_UPDATE_FALLBACK_MS } from '~/utils/pwaUpdate'

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
