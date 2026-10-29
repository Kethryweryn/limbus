import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createInvitationToken, hashInvitationToken } from '~/server/utils/invitations'

describe('jeton d’invitation (US-042, ADR-0034)', () => {
  it('ne garde que l’empreinte SHA-256 du jeton du lien', () => {
    const { token, tokenHash } = createInvitationToken()
    expect(token).toMatch(/^[\w-]{43}$/)
    expect(tokenHash).toBe(createHash('sha256').update(token).digest('hex'))
    expect(hashInvitationToken(token)).toBe(tokenHash)
  })
})
