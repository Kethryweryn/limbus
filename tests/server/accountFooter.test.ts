// US-247 (SPEC-022 R10, ADR-0088) : la ligne au bas des emails des équipes, selon le compte de l'adresse
import { afterEach, describe, expect, it } from 'vitest'
import { participantAccountFooter } from '~/server/utils/email'
import { prisma } from '~/server/utils/prisma'
import { runtimeConfig } from '../setup'

type Account = { emailConfirmedAt: Date | null, disabledAt: Date | null } | null
const users = prisma as unknown as { user: { findUnique: (args: unknown) => Promise<Account> } }
const withAccount = (account: Account) => {
  users.user = { findUnique: async () => account }
}

describe('participantAccountFooter', () => {
  afterEach(() => {
    runtimeConfig.publicAppUrl = ''
  })

  it('mène un compte activé à « Je participe »', async () => {
    runtimeConfig.publicAppUrl = 'https://limbuslarp.fr'
    withAccount({ emailConfirmedAt: new Date(), disabledAt: null })
    expect(await participantAccountFooter('paul@example.test')).toEqual({ text: 'Retrouvez tout cela dans votre espace « Je participe » sur Limbus :', url: 'https://limbuslarp.fr/participer' })
  })

  it('mène un compte non activé à la page d’activation, sans adresse ni jeton', async () => {
    runtimeConfig.publicAppUrl = 'https://limbuslarp.fr'
    withAccount({ emailConfirmedAt: null, disabledAt: null })
    const footer = await participantAccountFooter('paul@example.test')
    expect(footer).toEqual({ text: 'Retrouvez tout cela dans votre compte Limbus, en l’activant avec cette adresse :', url: 'https://limbuslarp.fr/acces/activer' })
    expect(JSON.stringify(footer)).not.toContain('paul')
  })

  it('ne met rien pour une adresse sans compte, ni pour un compte désactivé (revue de la PR #244)', async () => {
    withAccount(null)
    expect(await participantAccountFooter('paul@example.test')).toBeNull()
    withAccount({ emailConfirmedAt: new Date(), disabledAt: new Date() })
    expect(await participantAccountFooter('paul@example.test')).toBeNull()
  })
})
