// US-247 (SPEC-022 R10, ADR-0088) : la ligne au bas des emails des équipes, selon le compte de l'adresse
import { afterEach, describe, expect, it } from 'vitest'
import { participantAccountFooter } from '~/server/utils/email'
import { prisma } from '~/server/utils/prisma'
import { runtimeConfig } from '../setup'

const users = prisma as unknown as { user: { findUnique: (args: unknown) => Promise<{ emailConfirmedAt: Date | null } | null> } }

describe('participantAccountFooter', () => {
  afterEach(() => {
    runtimeConfig.publicAppUrl = ''
  })

  it('mène un compte activé à « Je participe »', async () => {
    runtimeConfig.publicAppUrl = 'https://limbuslarp.fr'
    users.user = { findUnique: async () => ({ emailConfirmedAt: new Date() }) }
    expect(await participantAccountFooter('paul@example.test')).toBe('Retrouvez tout cela dans votre espace « Je participe » sur Limbus : https://limbuslarp.fr/participer')
  })

  it('mène un compte non activé, ou une adresse sans compte, à la page d’activation, sans adresse ni jeton', async () => {
    runtimeConfig.publicAppUrl = 'https://limbuslarp.fr'
    for (const account of [{ emailConfirmedAt: null }, null]) {
      users.user = { findUnique: async () => account }
      const footer = await participantAccountFooter('paul@example.test')
      expect(footer).toBe('Retrouvez tout cela dans votre compte Limbus, en l’activant avec cette adresse : https://limbuslarp.fr/acces/activer')
      expect(footer).not.toContain('paul')
    }
  })
})
