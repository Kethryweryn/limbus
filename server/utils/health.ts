import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { prisma } from '~/server/utils/prisma'

// Page de santé (US-103, ADR-0052) : la base répond-elle, et quelle version est en ligne

const DATABASE_TIMEOUT_MS = 3000
let deployedVersion: string | null | undefined

/** Commit écrit par deploy.sh dans .output/VERSION, à côté de .output/server/index.mjs ; null sans fichier. */
export function readDeployedVersion(entry = process.argv[1]) {
  if (!entry) return null
  try {
    const version = readFileSync(resolve(dirname(entry), '..', 'VERSION'), 'utf8').trim()
    return /^[0-9a-f]{7,40}$/.test(version) ? version : null
  } catch {
    return null
  }
}

export function deployedVersionOnce() {
  if (deployedVersion === undefined) deployedVersion = readDeployedVersion()
  return deployedVersion
}

export async function databaseResponds() {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<false>((done) => {
    timer = setTimeout(() => done(false), DATABASE_TIMEOUT_MS)
  })
  try {
    return await Promise.race([prisma.$queryRaw`SELECT 1`.then(() => true), timeout])
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}
