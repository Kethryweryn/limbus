import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readDeployedVersion } from '~/server/utils/health'

// US-103 : version écrite par deploy.sh dans .output/VERSION, lue à côté de .output/server/index.mjs
describe('version déployée', () => {
  const output = mkdtempSync(join(tmpdir(), 'limbus-health-'))
  mkdirSync(join(output, 'server'))
  const entry = join(output, 'server', 'index.mjs')

  it('est absente sans fichier', () => {
    expect(readDeployedVersion(entry)).toBeNull()
    expect(readDeployedVersion(undefined)).toBeNull()
  })

  it('lit le commit, et ignore un contenu qui n’en est pas un', () => {
    writeFileSync(join(output, 'VERSION'), '405e373a1b2c3d4e5f60718293a4b5c6d7e8f901\n')
    expect(readDeployedVersion(entry)).toBe('405e373a1b2c3d4e5f60718293a4b5c6d7e8f901')
    writeFileSync(join(output, 'VERSION'), '<script>')
    expect(readDeployedVersion(entry)).toBeNull()
  })
})
