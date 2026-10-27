import { describe, expect, it } from 'vitest'
import { withSessionSendLock } from '~/server/utils/sendLock'

describe('withSessionSendLock', () => {
  it('refuse un second envoi sur la même session tant que le premier tourne', async () => {
    let finish!: () => void
    const first = withSessionSendLock('session-1', () => new Promise<string>((resolve) => { finish = () => resolve('envoyé') }))

    await expect(withSessionSendLock('session-1', async () => 'doublon')).rejects.toMatchObject({ statusCode: 409 })
    await expect(withSessionSendLock('session-2', async () => 'autre session')).resolves.toBe('autre session')

    finish()
    await expect(first).resolves.toBe('envoyé')
    await expect(withSessionSendLock('session-1', async () => 'ensuite')).resolves.toBe('ensuite')
  })

  it('libère la session même si l’envoi échoue', async () => {
    await expect(withSessionSendLock('session-3', async () => { throw new Error('SMTP') })).rejects.toThrow('SMTP')
    await expect(withSessionSendLock('session-3', async () => 'ok')).resolves.toBe('ok')
  })
})
