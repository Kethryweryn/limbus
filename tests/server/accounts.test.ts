import { afterEach, describe, expect, it } from 'vitest'
import { isSignupOpen } from '~/server/utils/accounts'

// L'inscription libre reste fermée tant que SIGNUP_OPEN ne vaut pas exactement 1 (US-061, R4)
describe('isSignupOpen', () => {
  afterEach(() => {
    delete process.env.SIGNUP_OPEN
  })

  it.each([[undefined, false], ['0', false], ['true', false], ['1', true]])('SIGNUP_OPEN=%s → %s', (value, open) => {
    if (value === undefined) delete process.env.SIGNUP_OPEN
    else process.env.SIGNUP_OPEN = value
    expect(isSignupOpen()).toBe(open)
  })
})
