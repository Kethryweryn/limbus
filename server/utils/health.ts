import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { prisma } from '~/server/utils/prisma'

// Page de santé (US-103, ADR-0052) : la base répond-elle, et quelle version est en ligne

const DATABASE_TIMEOUT_MS = 3000
let deployedVersion: string | null | undefined

/**
 * Commit écrit par deploy.sh dans .output/VERSION : cherché à côté du point d'entrée (.output/server/index.mjs), puis
 * dans le dossier de lancement ; null sans fichier.
 */
export function readDeployedVersion(entry = process.argv[1], cwd = process.cwd()) {
  const candidates = [entry && resolve(dirname(entry), '..', 'VERSION'), resolve(cwd, '.output', 'VERSION')].filter((path): path is string => Boolean(path))
  for (const path of candidates) {
    try {
      const version = readFileSync(path, 'utf8').trim()
      if (/^[0-9a-f]{7,40}$/.test(version)) return version
    } catch {
      // Fichier absent : on essaie l'emplacement suivant
    }
  }
  return null
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
