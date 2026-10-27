import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchPublicImage, isPrivateAddress } from '~/server/utils/remoteImage'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('isPrivateAddress', () => {
  it.each(['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '0.0.0.0', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1'])('bloque %s', (address) => {
    expect(isPrivateAddress(address)).toBe(true)
  })

  it.each(['62.210.109.188', '8.8.8.8', '2001:4860:4860::8888'])('laisse passer %s', (address) => {
    expect(isPrivateAddress(address)).toBe(false)
  })
})

describe('fetchPublicImage', () => {
  it.each(['http://localhost:8096/', 'http://127.0.0.1:3000/api/auth/me', 'http://[::1]/', 'file:///etc/passwd', 'javascript:alert(1)'])('ne contacte jamais %s', async (url) => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    await expect(fetchPublicImage(url)).resolves.toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
