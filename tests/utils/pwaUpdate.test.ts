// US-184 : la nouvelle version se charge au prochain changement de page (ADR-0071)
// US-196 : elle est cherchée à chaque changement de page, une fois par minute au plus (ADR-0078)
import { describe, expect, it, vi } from 'vitest'
import { afterNavigation, NewVersionCheck, PWA_UPDATE_CHECK_MS, PWA_UPDATE_FALLBACK_MS } from '~/utils/pwaUpdate'

const START = 1_000_000

function registration(installing: unknown = null, update: () => Promise<unknown> = async () => {}) {
  return { installing, update: vi.fn(update) }
}

function setup(needRefresh: boolean, reachable = true, activate = async () => {}) {
  const reg = registration()
  const pwa = { needRefresh, updateServiceWorker: vi.fn(activate), getSWRegistration: () => reg }
  const timers: Array<{ callback: () => void, delay: number }> = []
  const browser = { reachable, reload: vi.fn(), setTimeout: (callback: () => void, delay: number) => timers.push({ callback, delay }) }
  // Page chargée il y a plus d'une minute
  const check = new NewVersionCheck(START - PWA_UPDATE_CHECK_MS)
  return { pwa, reg, browser, timers, check }
}

describe('nouvelle version au changement de page', () => {
  it('sans nouvelle version, la fait chercher', () => {
    const { pwa, reg, browser, check } = setup(false)
    expect(afterNavigation(pwa, '/participants', '/', browser, check, START)).toBe('check')
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled()
    expect(reg.update).toHaveBeenCalledTimes(1)
    expect(afterNavigation(undefined, '/participants', '/', browser, check, START)).toBe('nothing')
  })

  it('avec une nouvelle version, active le service worker, et recharge quand même s’il ne prend pas la main', () => {
    const { pwa, reg, browser, timers, check } = setup(true)
    expect(afterNavigation(pwa, '/participants', '/', browser, check, START)).toBe('reload')
    expect(pwa.updateServiceWorker).toHaveBeenCalled()
    expect(reg.update).not.toHaveBeenCalled()
    expect(browser.reload).not.toHaveBeenCalled()
    expect(timers).toHaveLength(1)
    expect(timers[0]!.delay).toBe(PWA_UPDATE_FALLBACK_MS)
    timers[0]!.callback()
    expect(browser.reload).toHaveBeenCalled()
  })

  it('un échec d’activation ne remonte pas', async () => {
    const { pwa, browser, timers, check } = setup(true, true, async () => { throw new Error('refus') })
    expect(afterNavigation(pwa, '/participants', '/', browser, check, START)).toBe('reload')
    await Promise.resolve()
    expect(timers).toHaveLength(1)
  })

  it('hors ligne, serveur indisponible ou même page (requête seule), ne recharge ni ne cherche rien', () => {
    for (const [needRefresh, reachable, to, from] of [[true, false, '/participants', '/'], [false, false, '/participants', '/'], [true, true, '/sessions/a', '/sessions/a'], [false, true, '/sessions/a', '/sessions/a']] as const) {
      const { pwa, reg, browser, check } = setup(needRefresh, reachable)
      expect(afterNavigation(pwa, to, from, browser, check, START)).toBe('nothing')
      expect(pwa.updateServiceWorker).not.toHaveBeenCalled()
      expect(reg.update).not.toHaveBeenCalled()
    }
  })
})

describe('recherche d’une nouvelle version', () => {
  it('cherche une fois par minute au plus, et pas juste après le chargement de la page', () => {
    const reg = registration()
    const check = new NewVersionCheck(START)
    expect(check.run(reg, true, START + PWA_UPDATE_CHECK_MS - 1)).toBe(false)
    expect(check.run(reg, true, START + PWA_UPDATE_CHECK_MS)).toBe(true)
    expect(check.run(reg, true, START + 2 * PWA_UPDATE_CHECK_MS - 1)).toBe(false)
    expect(check.run(reg, true, START + 2 * PWA_UPDATE_CHECK_MS)).toBe(true)
    expect(reg.update).toHaveBeenCalledTimes(2)
  })

  it('ne cherche pas hors ligne, sans service worker, ni pendant un téléchargement', () => {
    const check = new NewVersionCheck(START - PWA_UPDATE_CHECK_MS)
    const reg = registration()
    const installing = registration({})
    expect(check.run(reg, false, START)).toBe(false)
    expect(check.run(undefined, true, START)).toBe(false)
    expect(check.run(installing, true, START)).toBe(false)
    expect(reg.update).not.toHaveBeenCalled()
    expect(installing.update).not.toHaveBeenCalled()
  })

  it('un échec ne remonte pas et ne fait pas attendre la recherche suivante', async () => {
    const check = new NewVersionCheck(START - PWA_UPDATE_CHECK_MS)
    const failing = registration(null, async () => { throw new Error('réseau') })
    expect(check.run(failing, true, START)).toBe(true)
    await Promise.resolve()
    await Promise.resolve()
    const reg = registration()
    expect(check.run(reg, true, START + 1)).toBe(true)
  })
})
