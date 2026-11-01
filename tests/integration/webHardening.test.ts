// EPIC-027 : origine des écritures (US-104), CSP en mode rapport (US-106)
import { afterAll, describe, expect, inject, it } from 'vitest'
import { api, tokenFor } from './api'
import { createTestPrisma } from './db'

const prisma = createTestPrisma()
const { alice, admin } = inject('world').users

afterAll(async () => {
  await prisma.$disconnect()
})

async function createGame(headers: Record<string, string>) {
  return await fetch(`${inject('baseUrl')}/api/games`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: `__Host-limbus_token=${tokenFor(alice)}`, ...headers },
    body: JSON.stringify({ title: `Jeu origine ${Date.now()}` })
  })
}

describe('origine des écritures (US-104)', () => {
  it('refuse une écriture venue d’un autre site, même connectée', async () => {
    expect((await createGame({ 'sec-fetch-site': 'cross-site' })).status).toBe(403)
    expect((await createGame({ 'sec-fetch-site': 'same-site' })).status).toBe(403)
  })

  it('sans Sec-Fetch-Site, compare Origin puis Referer à l’application, et refuse sans indice', async () => {
    // Le serveur de test a pour PUBLIC_APP_URL sa propre adresse
    const appOrigin = new URL(inject('baseUrl')).origin
    expect((await createGame({ 'x-test-no-origin': '1', origin: 'https://evil.example' })).status).toBe(403)
    expect((await createGame({ 'x-test-no-origin': '1' })).status).toBe(403)
    expect((await createGame({ 'x-test-no-origin': '1', origin: appOrigin })).status).toBe(200)
    expect((await createGame({ 'x-test-no-origin': '1', referer: `${appOrigin}/games` })).status).toBe(200)
  })

  it('protège aussi la connexion, et laisse passer les lectures', async () => {
    const login = await fetch(`${inject('baseUrl')}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' },
      body: JSON.stringify({ email: 'personne@example.test', password: 'x' })
    })
    expect(login.status).toBe(403)
    const read = await fetch(`${inject('baseUrl')}/api/public/health`, { headers: { 'sec-fetch-site': 'cross-site' } })
    expect(read.status).toBe(200)
  })
})

describe('CSP en mode rapport (US-106)', () => {
  it('pose une CSP stricte en mode rapport et la COOP sur les pages', async () => {
    const page = await fetch(`${inject('baseUrl')}/sessions`)
    expect(page.status).toBe(200)
    const policy = page.headers.get('content-security-policy-report-only')
    expect(page.headers.get('content-security-policy')).toBeNull()
    expect(policy).toMatch(/script-src [^;]*'nonce-[^']+'[^;]*'strict-dynamic'/)
    expect(policy).toContain("object-src 'none'")
    expect(policy).toContain('report-uri /api/public/csp-report')
    expect(page.headers.get('cross-origin-opener-policy')).toBe('same-origin')
  })

  it('compte les rapports, même envoyés sans origine, et ne les montre qu’à l’administratrice', async () => {
    const report = { 'csp-report': { 'document-uri': 'https://limbuslarp.fr/games/x?secret=1', 'violated-directive': 'img-src', 'effective-directive': 'img-src', 'blocked-uri': 'https://images.example/a.png?t=2' } }
    for (let i = 0; i < 2; i++) {
      const sent = await fetch(`${inject('baseUrl')}/api/public/csp-report`, {
        method: 'POST',
        headers: { 'content-type': 'application/csp-report', 'x-test-no-origin': '1', 'x-forwarded-for': '10.27.0.1' },
        body: JSON.stringify(report)
      })
      expect(sent.status).toBe(204)
    }
    const stored = await prisma.cspViolation.findFirstOrThrow({ where: { blockedUri: 'https://images.example' } })
    expect(stored).toMatchObject({ directive: 'img-src', documentPath: '/games/*', count: 2 })

    expect((await api(alice, 'GET', '/api/admin/csp-reports')).status).toBe(403)
    const listed = await api(admin, 'GET', '/api/admin/csp-reports', undefined, { adminMode: true })
    expect(listed.status).toBe(200)
    expect(listed.body).toEqual(expect.arrayContaining([expect.objectContaining({ directive: 'img-src', blockedUri: 'https://images.example', count: 2 })]))
  })
})
