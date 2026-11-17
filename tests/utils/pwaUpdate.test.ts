// US-254 : la nouvelle version est proposée par un bandeau, jamais chargée d'elle-même (ADR-0093)
// US-196 : elle est cherchée à chaque changement de page, une fois par minute au plus (ADR-0078)
import { describe, expect, it, vi } from 'vitest'
import { afterNavigation, applyUpdate, NewVersionCheck, PWA_UPDATE_CHECK_MS, PWA_UPDATE_FALLBACK_MS } from '~/utils/pwaUpdate'

const START = 1_000_000

function registration(installing: unknown = null, update: () => Promise<unknown> = async () => {}, waiting: unknown = null) {
  return { installing, waiting, update: vi.fn(update) }
}

function setup(needRefresh: boolean, { waiting = {}, activate = async () => {} }: { waiting?: unknown, activate?: () => Promise<void> } = {}) {
  const reg = registration(null, async () => {}, waiting)
  const pwa = { needRefresh, dismissed: false, applying: false, updateServiceWorker: vi.fn(activate), getSWRegistration: () => reg }
  const timers: Array<{ callback: () => void, delay: number }> = []
  const browser = { reload: vi.fn(), setTimeout: (callback: () => void, delay: number) => timers.push({ callback, delay }) }
  // Page chargée il y a plus d'une minute
  const check = new NewVersionCheck(START - PWA_UPDATE_CHECK_MS)
  return { pwa, reg, browser, timers, check }
}

describe('changement de page', () => {
  it('sans nouvelle version, la fait chercher', () => {
    const { pwa, reg, check } = setup(false)
    expect(afterNavigation(pwa, '/participants', '/', true, check, START)).toBe('check')
    expect(reg.update).toHaveBeenCalledTimes(1)
    expect(afterNavigation(undefined, '/participants', '/', true, check, START)).toBe('nothing')
  })

  it('avec une version qui attend, ne recharge ni n’active rien, mais en cherche une plus récente', () => {
    const { pwa, reg, browser, check } = setup(true)
    expect(afterNavigation(pwa, '/participants', '/', true, check, START)).toBe('check')
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled()
    expect(browser.reload).not.toHaveBeenCalled()
    expect(reg.update).toHaveBeenCalledTimes(1)
  })

  it('hors ligne, serveur indisponible ou même page (requête seule), ne cherche rien', () => {
    for (const [reachable, to, from] of [[false, '/participants', '/'], [true, '/sessions/a', '/sessions/a']] as const) {
      const { pwa, reg, check } = setup(false)
      expect(afterNavigation(pwa, to, from, reachable, check, START)).toBe('nothing')
      expect(reg.update).not.toHaveBeenCalled()
    }
  })
})

describe('« Recharger »', () => {
  it('active la version qui attend, et recharge quand même si elle ne prend pas la main', () => {
    const { pwa, browser, timers } = setup(true)
    expect(applyUpdate(pwa, browser)).toBe('activate')
    expect(pwa.applying).toBe(true)
    expect(pwa.updateServiceWorker).toHaveBeenCalled()
    expect(browser.reload).not.toHaveBeenCalled()
    expect(timers).toEqual([{ callback: browser.reload, delay: PWA_UPDATE_FALLBACK_MS }])
  })

  it('une version déjà activée par un autre onglet : recharge aussitôt', () => {
    const { pwa, browser, timers } = setup(true, { waiting: null })
    expect(applyUpdate(pwa, browser)).toBe('reload')
    expect(browser.reload).toHaveBeenCalled()
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled()
    expect(timers).toHaveLength(0)
  })

  it('un échec d’activation ne remonte pas', async () => {
    const { pwa, browser, timers } = setup(true, { activate: async () => { throw new Error('refus') } })
    expect(applyUpdate(pwa, browser)).toBe('activate')
    await Promise.resolve()
    expect(timers).toHaveLength(1)
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
