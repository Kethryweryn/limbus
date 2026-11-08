// US-184 : la nouvelle version se charge au prochain changement de page (ADR-0071)
import { describe, expect, it, vi } from 'vitest'
import { loadNewVersionOnNavigation, PWA_UPDATE_FALLBACK_MS } from '~/utils/pwaUpdate'

function setup(needRefresh: boolean, online = true) {
  const pwa = { needRefresh, updateServiceWorker: vi.fn(async () => {}) }
  const timers: Array<{ callback: () => void, delay: number }> = []
  const browser = {
    online,
    pushState: vi.fn(),
    assign: vi.fn(),
    setTimeout: (callback: () => void, delay: number) => timers.push({ callback, delay })
  }
  return { pwa, browser, timers }
}

describe('nouvelle version au changement de page', () => {
  it('sans nouvelle version, laisse la navigation se faire', () => {
    const { pwa, browser } = setup(false)
    expect(loadNewVersionOnNavigation(pwa, '/participants', '/', browser)).toBe(false)
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled()
    expect(loadNewVersionOnNavigation(undefined, '/participants', '/', browser)).toBe(false)
  })

  it('avec une nouvelle version, active le service worker et charge la page visée', () => {
    const { pwa, browser, timers } = setup(true)
    expect(loadNewVersionOnNavigation(pwa, '/participants', '/', browser)).toBe(true)
    expect(browser.pushState).toHaveBeenCalledWith('/participants')
    expect(pwa.updateServiceWorker).toHaveBeenCalled()
    // Si le service worker ne prend pas la main, la page visée se charge quand même
    expect(browser.assign).not.toHaveBeenCalled()
    expect(timers).toHaveLength(1)
    expect(timers[0]!.delay).toBe(PWA_UPDATE_FALLBACK_MS)
    timers[0]!.callback()
    expect(browser.assign).toHaveBeenCalledWith('/participants')
  })

  it('hors ligne ou sans changer de page, ne recharge rien', () => {
    const offline = setup(true, false)
    expect(loadNewVersionOnNavigation(offline.pwa, '/participants', '/', offline.browser)).toBe(false)
    const same = setup(true)
    expect(loadNewVersionOnNavigation(same.pwa, '/participants', '/participants', same.browser)).toBe(false)
    expect(offline.pwa.updateServiceWorker).not.toHaveBeenCalled()
    expect(same.pwa.updateServiceWorker).not.toHaveBeenCalled()
  })
})
