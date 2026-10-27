// Recrée les auto-imports Nitro utilisés par server/utils, pour tester ces modules hors de Nuxt.
import { createError, getHeader, setHeader } from 'h3'
import { beforeEach, vi } from 'vitest'

export const runtimeConfig: Record<string, string | undefined> = {}

Object.assign(globalThis, {
  createError,
  getHeader,
  setHeader,
  useRuntimeConfig: () => runtimeConfig
})

// Les modules testés importent le client Prisma, qui exige une base : on le neutralise.
vi.mock('~/server/utils/prisma', () => ({ prisma: {} }))

beforeEach(() => {
  for (const key of Object.keys(runtimeConfig)) Reflect.deleteProperty(runtimeConfig, key)
})
