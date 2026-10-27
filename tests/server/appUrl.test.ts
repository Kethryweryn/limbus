import { afterEach, describe, expect, it, vi } from 'vitest'
import { absoluteAppUrl, publicAppUrl } from '~/server/utils/appUrl'
import { runtimeConfig } from '../setup'

describe('URL publique', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('retire les slashs finaux et construit des URLs absolues', () => {
    runtimeConfig.publicAppUrl = 'https://limbuslarp.fr//'
    expect(publicAppUrl()).toBe('https://limbuslarp.fr')
    expect(absoluteAppUrl('invitations/abc')).toBe('https://limbuslarp.fr/invitations/abc')
  })

  it('refuse une URL sans schéma http(s)', () => {
    runtimeConfig.publicAppUrl = 'javascript:alert(1)'
    expect(() => publicAppUrl()).toThrow()
  })

  it('exige PUBLIC_APP_URL en production', () => {
    vi.stubEnv('PUBLIC_APP_URL', '')
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => publicAppUrl()).toThrow()
  })
})
