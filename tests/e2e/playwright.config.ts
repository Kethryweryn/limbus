import { defineConfig, devices } from '@playwright/test'
import { JWT_SECRET } from '../integration/constants'
import { testDatabaseUrl } from '../integration/db'

const PORT = Number(process.env.E2E_PORT || 3998)
// localhost (et non 127.0.0.1) : le navigateur y accepte les cookies « Secure » en http
export const BASE_URL = `http://localhost:${PORT}`

// Parcours dans un vrai navigateur, contre l'application compilée et la base de test jetable.
// Prérequis : `npm run build` et TEST_DATABASE_URL (nom contenant « test », elle est vidée).
export default defineConfig({
  testDir: '.',
  globalSetup: './globalSetup.ts',
  // Échoue si la CSP a refusé une ressource pendant la suite (US-250)
  globalTeardown: './globalTeardown.ts',
  // Les fichiers se répartissent entre trois navigateurs ; les tests d'un fichier se suivent. Les tests partagent la
  // base et le serveur d'emails : chacun crée ses propres données et écrit à ses propres adresses (mailbox.ts).
  fullyParallel: false,
  workers: 3,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node .output/server/index.mjs',
    cwd: '../..',
    url: `${BASE_URL}/api/auth/me`,
    reuseExistingServer: false,
    env: {
      NODE_ENV: 'production',
      DATABASE_URL: testDatabaseUrl(),
      JWT_SECRET,
      PUBLIC_APP_URL: BASE_URL,
      // Inscription libre ouverte, pour tester son parcours (fermée en production tant que l'utilisatrice ne l'ouvre pas)
      SIGNUP_OPEN: '1',
      HOST: '127.0.0.1',
      PORT: String(PORT)
    }
  }
})
