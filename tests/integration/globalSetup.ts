import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import type { TestProject } from 'vitest/node'
import { createWorld, type World } from './fixtures'
import { createTestPrisma, testDatabaseUrl } from './db'
import { JWT_SECRET } from './constants'

const PORT = Number(process.env.TEST_PORT || 3999)

declare module 'vitest' {
  export interface ProvidedContext {
    baseUrl: string
    world: World
  }
}

let server: ChildProcess | undefined

async function waitForServer(url: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const response = await fetch(`${url}/api/auth/me`)
      if (response.ok) return
    } catch {
      // pas encore démarré
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error('Le serveur de test n’a pas démarré')
}

export default async function setup(project: TestProject) {
  const databaseUrl = testDatabaseUrl()
  if (!existsSync('.output/server/index.mjs')) {
    throw new Error('Build introuvable : lancer `npm run build` avant les tests d’intégration')
  }

  execFileSync('npx', ['prisma', 'migrate', 'reset', '--force'], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
    shell: process.platform === 'win32'
  })

  const prisma = createTestPrisma()
  const world = await createWorld(prisma)
  await prisma.$disconnect()

  server = spawn(process.execPath, ['.output/server/index.mjs'], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      DATABASE_URL: databaseUrl,
      JWT_SECRET,
      PUBLIC_APP_URL: `http://127.0.0.1:${PORT}`,
      HOST: '127.0.0.1',
      PORT: String(PORT)
    },
    stdio: ['ignore', 'ignore', 'inherit']
  })

  const baseUrl = `http://127.0.0.1:${PORT}`
  await waitForServer(baseUrl)

  // Les dates deviennent des chaînes en passant par provide : les tests n'utilisent que les ids et noms
  project.provide('baseUrl', baseUrl)
  project.provide('world', JSON.parse(JSON.stringify(world)))

  return () => {
    server?.kill()
  }
}
