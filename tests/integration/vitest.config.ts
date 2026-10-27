import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Tests d'intégration : l'application compilée (.output) tourne contre une base PostgreSQL jetable.
// Prérequis : `npm run build` et TEST_DATABASE_URL (base dont le nom contient « test », elle est vidée).
export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('../..', import.meta.url))
    }
  },
  test: {
    include: ['tests/integration/**/*.test.ts'],
    globalSetup: ['tests/integration/globalSetup.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000
  }
})
