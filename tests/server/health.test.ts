import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { databaseResponds, readDeployedVersion } from '~/server/utils/health'
import { prisma } from '~/server/utils/prisma'

// US-103 : version écrite par deploy.sh dans .output/VERSION, lue à côté de .output/server/index.mjs
describe('version déployée', () => {
  const output = mkdtempSync(join(tmpdir(), 'limbus-health-'))
  mkdirSync(join(output, 'server'))
  const entry = join(output, 'server', 'index.mjs')

  it('est absente sans fichier', () => {
    expect(readDeployedVersion(entry, output)).toBeNull()
    expect(readDeployedVersion(undefined, output)).toBeNull()
  })

  it('lit le commit, et ignore un contenu qui n’en est pas un', () => {
    writeFileSync(join(output, 'VERSION'), '405e373a1b2c3d4e5f60718293a4b5c6d7e8f901\n')
    expect(readDeployedVersion(entry, output)).toBe('405e373a1b2c3d4e5f60718293a4b5c6d7e8f901')
    writeFileSync(join(output, 'VERSION'), '<script>')
    expect(readDeployedVersion(entry, output)).toBeNull()
  })

  it('se trouve aussi depuis le dossier de lancement, quel que soit le point d’entrée', () => {
    const app = mkdtempSync(join(tmpdir(), 'limbus-app-'))
    mkdirSync(join(app, '.output'))
    writeFileSync(join(app, '.output', 'VERSION'), 'abc1234')
    expect(readDeployedVersion('/ailleurs/lanceur.js', app)).toBe('abc1234')
  })
})

describe('base de données (US-103)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('répond, échoue ou dépasse 3 secondes', async () => {
    const db = prisma as unknown as { $queryRaw: (...args: unknown[]) => Promise<unknown> }
    db.$queryRaw = () => Promise.resolve([{ '?column?': 1 }])
    expect(await databaseResponds()).toBe(true)
    db.$queryRaw = () => Promise.reject(new Error('connexion refusée'))
    expect(await databaseResponds()).toBe(false)

    vi.useFakeTimers()
    db.$queryRaw = () => new Promise(() => {})
    const pending = databaseResponds()
    await vi.advanceTimersByTimeAsync(3000)
    expect(await pending).toBe(false)
  })
})
