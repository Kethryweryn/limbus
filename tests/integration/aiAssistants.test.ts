// EPIC-033 (US-121 à US-123, SPEC-014) : un assistant d'IA se branche par OAuth (inscription dynamique, PKCE), lit les
// seuls jeux cochés, sans données personnelles, et s'arrête au retrait, à la réutilisation d'un jeton ou à la
// déconnexion partout. Le client est le client MCP officiel.
import { createHash } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { Client, StreamableHTTPClientTransport, UnauthorizedError } from '@modelcontextprotocol/client'
import type { OAuthClientMetadata, OAuthClientProvider, OAuthDiscoveryState, StoredOAuthClientInformation, StoredOAuthTokens } from '@modelcontextprotocol/client'
import { api } from './api'
import { createTestPrisma } from './db'
import { TERMS_VERSION } from '~/utils/legal'

const baseUrl = inject('baseUrl')
const world = inject('world')
const { alice, bob, carol, admin } = world.users
const { a, b } = world
const prisma = createTestPrisma()
const REDIRECT = 'http://localhost:9999/callback'
const mcpUrl = new URL('/mcp', baseUrl)

type User = { id: string }

class TestProvider implements OAuthClientProvider {
  info: StoredOAuthClientInformation | undefined
  saved: StoredOAuthTokens | undefined
  verifier = ''
  discovery: OAuthDiscoveryState | undefined
  authUrl: URL | undefined
  get redirectUrl() { return REDIRECT }
  get clientMetadata(): OAuthClientMetadata {
    return { client_name: 'Assistant de test', redirect_uris: [REDIRECT], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none' }
  }
  clientInformation() { return this.info }
  saveClientInformation(info: StoredOAuthClientInformation) { this.info = info }
  tokens() { return this.saved }
  saveTokens(tokens: StoredOAuthTokens) { this.saved = tokens }
  redirectToAuthorization(url: URL) { this.authUrl = url }
  saveCodeVerifier(verifier: string) { this.verifier = verifier }
  codeVerifier() { return this.verifier }
  saveDiscoveryState(state: OAuthDiscoveryState) { this.discovery = state }
  discoveryState() { return this.discovery }
}

/** Parcours complet : le client découvre et s'inscrit, la personne décide sur la page « Autoriser », le code est échangé. */
async function connectAssistant(user: User, decision: { canWrite?: boolean, gameIds: string[] }) {
  const provider = new TestProvider()
  const transport = new StreamableHTTPClientTransport(mcpUrl, { authProvider: provider })
  await expect(new Client({ name: 'test', version: '1.0.0' }).connect(transport)).rejects.toBeInstanceOf(UnauthorizedError)

  const authorize = await fetch(provider.authUrl!, { redirect: 'manual' })
  expect(authorize.status).toBe(302)
  const requestId = authorize.headers.get('location')!.match(/^\/autoriser\/([^/?]+)$/)![1]!
  const described = await api(user, 'GET', `/api/oauth/requests/${requestId}`)
  expect(described.status).toBe(200)
  const decided = await api(user, 'POST', `/api/oauth/requests/${requestId}/decision`, { allow: true, canWrite: decision.canWrite ?? false, gameIds: decision.gameIds })
  expect(decided.status).toBe(200)
  const callback = new URL((decided.body as { redirectUrl: string }).redirectUrl)
  expect(callback.searchParams.get('iss')).toBe(baseUrl)
  await transport.finishAuth(callback.searchParams)

  const client = new Client({ name: 'test', version: '1.0.0' })
  await client.connect(new StreamableHTTPClientTransport(mcpUrl, { authProvider: provider }))
  return { client, provider, offered: (described.body as { games: Array<{ id: string }> }).games.map((game) => game.id) }
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args })
  const text = (result.content as Array<{ text: string }>)[0]!.text
  return { error: Boolean(result.isError), text, json: result.isError ? null : JSON.parse(text) }
}

// Appel brut, sans le rafraîchissement automatique du SDK, pour vérifier un refus
async function rawStatus(token: string, headers: Record<string, string> = {}) {
  const response = await fetch(mcpUrl, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
  })
  return response.status
}

async function token(params: Record<string, string>) {
  const response = await fetch(`${baseUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ resource: mcpUrl.href, ...params })
  })
  return { status: response.status, body: await response.json() as Record<string, string> }
}

let dora: User
let doraGameId: string

beforeAll(async () => {
  // Les assistants exigent la version en vigueur des conditions (SPEC-014, R3)
  await prisma.user.updateMany({ where: { id: { in: [alice.id, bob.id, carol.id, admin.id] } }, data: { termsAcceptedVersion: TERMS_VERSION } })
  // Compte propre aux tests de déconnexion partout : ses sessions sont coupées
  const created = await prisma.user.create({ data: { email: 'dora-ia@example.test', name: 'Dora', password: 'non-utilise', termsAcceptedVersion: TERMS_VERSION } })
  dora = created
  doraGameId = (await prisma.game.create({ data: { title: 'Jeu de Dora', slug: 'jeu-de-dora-ia', description: '', ownerId: created.id } })).id
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('découverte', () => {
  it('sans jeton, /mcp désigne les métadonnées de la ressource protégée', async () => {
    const response = await fetch(mcpUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    expect(response.status).toBe(401)
    expect(response.headers.get('www-authenticate')).toMatch(/resource_metadata="[^"]+\/\.well-known\/oauth-protected-resource\/mcp"/)

    const resource = await (await fetch(`${baseUrl}/.well-known/oauth-protected-resource/mcp`)).json()
    expect(resource).toMatchObject({ resource: mcpUrl.href, authorization_servers: [baseUrl] })
    const server = await (await fetch(`${baseUrl}/.well-known/oauth-authorization-server`)).json()
    expect(server).toMatchObject({
      issuer: baseUrl,
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      client_id_metadata_document_supported: true,
      authorization_response_iss_parameter_supported: true
    })
  })

  it('le cookie de connexion n’ouvre pas /mcp', async () => {
    const response = await api(alice, 'POST', '/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
    expect(response.status).toBe(401)
  })
})

describe('lecture', () => {
  it('ne voit que les jeux cochés, et rien d’un autre compte', async () => {
    const { client, offered } = await connectAssistant(alice, { gameIds: [a.game.id] })
    expect(offered).toContain(a.game.id)
    expect(offered).not.toContain(b.game.id)

    const games = await call(client, 'lister_jeux')
    expect(games.json.map((game: { id: string }) => game.id)).toEqual([a.game.id])
    // Le monde de test est partagé : les noms peuvent avoir changé, les identifiants non
    expect((await call(client, 'lire_contenu', { type: 'personnages', id: a.character.id })).json.id).toBe(a.character.id)
    expect((await call(client, 'lire_contenu', { type: 'personnages', id: b.character.id })).error).toBe(true)
    expect((await call(client, 'lire_jeu', { jeuId: b.game.id })).error).toBe(true)
    expect((await call(client, 'lister_contenu', { jeuId: a.game.id, type: 'documents' })).json.items.map((item: { id: string }) => item.id)).toContain(a.document.id)
    expect((await call(client, 'lire_session', { sessionId: b.session.id })).error).toBe(true)
  })

  it('ne rend ni coordonnées ni allergies des participants', async () => {
    await prisma.registration.update({ where: { id: a.registration.id }, data: { phone: '0612345678', dietary: 'Arachides', questionAnswers: { libre: 'texte libre' } } })
    const { client } = await connectAssistant(alice, { gameIds: [a.game.id] })
    const participants = await call(client, 'lister_participants', { jeuId: a.game.id })
    const items = participants.json.items as Array<Record<string, unknown>>
    expect(items.map((item) => item.id)).toContain(a.participant.id)
    // Nom et notes du jeu seulement
    for (const item of items) expect(Object.keys(item).sort()).toEqual(['id', 'name', 'notes'])
    const selection = await call(client, 'lire_selection', { periodeId: a.registrationPeriod.id })
    expect(selection.json.registrations.map((row: { participant: { id: string } }) => row.participant.id)).toContain(a.participant.id)
    for (const secret of [a.participant.email!, '0612345678', 'Arachides', 'texte libre']) {
      expect(participants.text + selection.text).not.toContain(secret)
    }
  })

  it('le cookie du mode administrateur ne donne pas tous les jeux', async () => {
    const { provider } = await connectAssistant(admin, { gameIds: [] })
    const response = await fetch(mcpUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${provider.saved!.access_token}`,
        cookie: '__Host-limbus_admin_mode=1',
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream'
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'lister_jeux', arguments: {} } })
    })
    const text = await response.text()
    expect(response.status).toBe(200)
    expect(text).not.toContain(a.game.id)
  })
})

describe('jeux partagés', () => {
  it('ne s’ouvrent aux assistants des co-organisatrices que si la propriétaire le permet', async () => {
    expect((await api(carol, 'PUT', `/api/games/${b.game.id}/ai-settings`, { aiForCoorganizers: true })).status).toBe(403)
    const closed = await connectAssistant(carol, { gameIds: [] })
    expect(closed.offered).not.toContain(b.game.id)

    expect((await api(bob, 'PUT', `/api/games/${b.game.id}/ai-settings`, { aiForCoorganizers: true })).status).toBe(200)
    const { client, offered } = await connectAssistant(carol, { gameIds: [b.game.id] })
    expect(offered).toContain(b.game.id)
    expect((await call(client, 'lister_jeux')).json.map((game: { id: string }) => game.id)).toEqual([b.game.id])

    const access = await api(bob, 'GET', `/api/games/${b.game.id}/ai-access`)
    expect((access.body as { authorizations: Array<{ user: { id: string } }> }).authorizations.some((row) => row.user.id === carol.id)).toBe(true)

    // Réglage désactivé : l'accès tombe aussitôt
    await api(bob, 'PUT', `/api/games/${b.game.id}/ai-settings`, { aiForCoorganizers: false })
    expect((await call(client, 'lister_jeux')).json).toEqual([])
    expect((await call(client, 'lire_jeu', { jeuId: b.game.id })).error).toBe(true)
  })
})

describe('jetons', () => {
  it('refuse un code réutilisé, un mauvais vérificateur PKCE et une autre ressource', async () => {
    const registered = await (await fetch(`${baseUrl}/oauth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_name: 'Brut', redirect_uris: [REDIRECT] })
    })).json() as { client_id: string }
    const verifier = 'v'.repeat(50)
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    const query = new URLSearchParams({ response_type: 'code', client_id: registered.client_id, redirect_uri: REDIRECT, code_challenge: challenge, code_challenge_method: 'S256', resource: mcpUrl.href, state: 'etat' })

    expect((await fetch(`${baseUrl}/oauth/authorize?${query}&redirect_uri=https://evil.example/cb`, { redirect: 'manual' })).status).toBe(400)
    const noPkce = await fetch(`${baseUrl}/oauth/authorize?${new URLSearchParams({ response_type: 'code', client_id: registered.client_id, redirect_uri: REDIRECT, state: 'etat' })}`, { redirect: 'manual' })
    expect(new URL(noPkce.headers.get('location')!).searchParams.get('error')).toBe('invalid_request')

    const requestId = (await fetch(`${baseUrl}/oauth/authorize?${query}`, { redirect: 'manual' })).headers.get('location')!.split('/').pop()!
    const decided = await api(alice, 'POST', `/api/oauth/requests/${requestId}/decision`, { allow: true, canWrite: false, gameIds: [a.game.id] })
    const callback = new URL((decided.body as { redirectUrl: string }).redirectUrl)
    expect(callback.searchParams.get('state')).toBe('etat')
    const code = callback.searchParams.get('code')!
    const exchange = { grant_type: 'authorization_code', code, client_id: registered.client_id, redirect_uri: REDIRECT }

    expect((await token({ ...exchange, code_verifier: 'w'.repeat(50) })).body.error).toBe('invalid_grant')
    // Le code a servi (même pour un échec) : il ne passe plus
    expect((await token({ ...exchange, code_verifier: verifier })).body.error).toBe('invalid_grant')
    expect((await token({ ...exchange, code_verifier: verifier, resource: 'https://autre.example/mcp' })).body.error).toBe('invalid_target')
  })

  it('renouvelle le rafraîchissement, et une réutilisation fait tomber l’autorisation', async () => {
    const { provider } = await connectAssistant(alice, { gameIds: [a.game.id] })
    const first = provider.saved!
    const renewed = await token({ grant_type: 'refresh_token', refresh_token: first.refresh_token!, client_id: provider.info!.client_id })
    expect(renewed.status).toBe(200)
    expect(renewed.body.refresh_token).not.toBe(first.refresh_token)
    expect(await rawStatus(renewed.body.access_token!)).toBe(200)

    const reused = await token({ grant_type: 'refresh_token', refresh_token: first.refresh_token!, client_id: provider.info!.client_id })
    expect(reused.body.error).toBe('invalid_grant')
    expect(await rawStatus(renewed.body.access_token!)).toBe(401)
  })

  it('deux rafraîchissements simultanés n’en renouvellent qu’un, sans retirer l’autorisation', async () => {
    const { provider } = await connectAssistant(alice, { gameIds: [a.game.id] })
    const params = { grant_type: 'refresh_token', refresh_token: provider.saved!.refresh_token!, client_id: provider.info!.client_id }
    const results = await Promise.all([token(params), token(params)])
    const won = results.filter((result) => result.status === 200)
    expect(won).toHaveLength(1)
    expect(await rawStatus(won[0]!.body.access_token!)).toBe(200)
  })

  it('la déconnexion partout coupe l’assistant', async () => {
    const { provider } = await connectAssistant(dora, { gameIds: [doraGameId] })
    expect(await rawStatus(provider.saved!.access_token)).toBe(200)
    expect((await api(dora, 'POST', '/api/auth/logout-all')).status).toBe(200)
    expect(await rawStatus(provider.saved!.access_token)).toBe(401)
    const refreshed = await token({ grant_type: 'refresh_token', refresh_token: provider.saved!.refresh_token!, client_id: provider.info!.client_id })
    expect(refreshed.body.error).toBe('invalid_grant')
  })
})

// EPIC-034 (US-125, US-126) : écriture du contenu d'un jeu, dans un jeu créé par l'assistant
describe('écriture', () => {
  it('une autorisation en lecture seule n’a aucun outil d’écriture', async () => {
    const { client } = await connectAssistant(alice, { gameIds: [a.game.id] })
    const names = (await client.listTools()).tools.map((tool) => tool.name)
    expect(names).toContain('lister_jeux')
    expect(names.filter((name) => /^(creer|modifier|enregistrer|supprimer)_/.test(name))).toEqual([])
  })

  it('crée un jeu et tout son contenu, modifie champ par champ, supprime, et note chaque écriture', async () => {
    const { client } = await connectAssistant(alice, { canWrite: true, gameIds: [a.game.id] })
    const tools = (await client.listTools()).tools
    expect(tools.find((tool) => tool.name === 'supprimer_contenu')?.annotations?.destructiveHint).toBe(true)
    expect(tools.find((tool) => tool.name === 'enregistrer_personnage')?.annotations?.readOnlyHint).toBe(false)

    const game = (await call(client, 'creer_jeu', { title: 'Jeu écrit par l’assistant', description: 'Huis clos' })).json
    expect((await call(client, 'lister_jeux')).json.map((row: { id: string }) => row.id)).toContain(game.id)
    expect((await prisma.game.findUniqueOrThrow({ where: { id: game.id } })).ownerId).toBe(alice.id)

    const hero = (await call(client, 'enregistrer_personnage', { jeuId: game.id, name: 'Aube', pitch: 'Héritière', sheetReadyToSend: true, trombinoscopeDisplayName: 'Aube' })).json
    const rival = (await call(client, 'enregistrer_personnage', { jeuId: game.id, name: 'Crépuscule' })).json
    const faction = (await call(client, 'enregistrer_faction', { jeuId: game.id, name: 'Maison', characterIds: [hero.id, rival.id] })).json
    const intrigue = (await call(client, 'enregistrer_intrigue', { jeuId: game.id, name: 'Succession', characterIds: [hero.id], factionIds: [faction.id] })).json
    const item = (await call(client, 'enregistrer_objet', { jeuId: game.id, name: 'Testament', locationCharacterId: hero.id })).json
    const location = (await call(client, 'enregistrer_lieu', { jeuId: game.id, name: 'Tour' })).json
    const timelineEvent = (await call(client, 'enregistrer_evenement', { jeuId: game.id, name: 'Ouverture', day: 1, time: '10:00', intrigueIds: [intrigue.id] })).json
    const relation = (await call(client, 'enregistrer_relation', { type: 'rivalry', fromCharacterId: hero.id, toCharacterId: rival.id, fromVisible: true })).json
    for (const saved of [hero, rival, faction, intrigue, item, location, timelineEvent, relation]) expect(saved.id).toBeTruthy()
    expect((await prisma.character.findUniqueOrThrow({ where: { id: hero.id } })).sheetReadyToSend).toBe(true)

    // Un document avec un fichier posé dans l'interface : l'assistant change le texte, le fichier reste
    const withFile = await api(alice, 'POST', '/api/documents', { title: 'Plan', content: 'Version 1', documentUrl: 'https://exemple.test/plan.pdf', gameId: game.id })
    expect(withFile.status).toBe(200)
    const documentId = (withFile.body as { id: string }).id
    const documentRead = (await call(client, 'lire_contenu', { type: 'documents', id: documentId })).json
    expect((await call(client, 'enregistrer_document', { id: documentId, version: documentRead.updatedAt, content: 'Version 2' })).error).toBe(false)
    expect(await prisma.document.findUniqueOrThrow({ where: { id: documentId }, select: { content: true, documentUrl: true } })).toEqual({ content: 'Version 2', documentUrl: 'https://exemple.test/plan.pdf' })

    // Un champ donné seul : les membres de la faction restent
    const factionRead = (await call(client, 'lire_contenu', { type: 'factions', id: faction.id })).json
    const changed = await call(client, 'enregistrer_faction', { id: faction.id, version: factionRead.updatedAt, pitch: 'Ancienne maison' })
    expect(changed.error).toBe(false)
    const factionNow = await prisma.faction.findUniqueOrThrow({ where: { id: faction.id }, include: { characters: true } })
    expect(factionNow.pitch).toBe('Ancienne maison')
    expect(factionNow.characters.map((character) => character.id).sort()).toEqual([hero.id, rival.id].sort())

    // Version dépassée : refus, rien n'est écrit
    const stale = await call(client, 'enregistrer_faction', { id: faction.id, version: factionRead.updatedAt, pitch: 'Écrasée' })
    expect(stale.error).toBe(true)
    expect(stale.text).toContain('modifié par quelqu’un d’autre')
    expect((await call(client, 'enregistrer_faction', { id: faction.id, pitch: 'Sans version' })).error).toBe(true)

    // Lien vers un élément d'un autre jeu, et écriture hors de l'autorisation
    expect((await call(client, 'enregistrer_intrigue', { jeuId: game.id, name: 'Intruse', characterIds: [b.character.id] })).error).toBe(true)
    expect((await call(client, 'enregistrer_personnage', { jeuId: b.game.id, name: 'Intrus' })).error).toBe(true)
    const bRead = await prisma.character.findUniqueOrThrow({ where: { id: b.character.id } })
    expect((await call(client, 'enregistrer_personnage', { id: b.character.id, version: bRead.updatedAt.toISOString(), name: 'Volé' })).error).toBe(true)
    expect((await call(client, 'supprimer_contenu', { type: 'personnage', id: b.character.id, version: bRead.updatedAt.toISOString() })).error).toBe(true)

    // Le jeu lui-même : présentation seulement
    const gameRead = (await call(client, 'lire_jeu', { jeuId: game.id })).json
    expect((await call(client, 'modifier_jeu', { jeuId: game.id, version: gameRead.updatedAt, title: 'Jeu renommé' })).error).toBe(false)
    expect((await prisma.game.findUniqueOrThrow({ where: { id: game.id } })).title).toBe('Jeu renommé')

    // Suppression : définitive, avec la version lue
    const relationRead = (await call(client, 'lister_relations', { jeuId: game.id })).json[0]
    expect((await call(client, 'supprimer_contenu', { type: 'relation', id: relation.id, version: relationRead.updatedAt })).json).toEqual({ deleted: true })
    const rivalRead = (await call(client, 'lire_contenu', { type: 'personnages', id: rival.id })).json
    expect((await call(client, 'supprimer_contenu', { type: 'personnage', id: rival.id, version: rivalRead.updatedAt })).error).toBe(false)
    expect(await prisma.character.count({ where: { id: rival.id } })).toBe(0)

    const log = await prisma.aiLogEntry.findMany({ where: { gameId: game.id }, orderBy: { createdAt: 'asc' } })
    expect(log.map((entry) => `${entry.action} ${entry.targetType} ${entry.targetName}`)).toEqual(expect.arrayContaining([
      'création game Jeu écrit par l’assistant',
      'création character Aube',
      'mise à jour faction Maison',
      'mise à jour document Plan',
      'mise à jour game Jeu renommé',
      'suppression characterRelation rivalry',
      'suppression character Crépuscule'
    ]))
  })
})

describe('assistants connectés', () => {
  it('liste, change les jeux, retire, et garde la trace au journal et dans l’export', async () => {
    const { client, provider } = await connectAssistant(bob, { gameIds: [b.game.id] })
    const listing = await api(bob, 'GET', '/api/account/ai-authorizations')
    const mine = (listing.body as { authorizations: Array<{ id: string, client: { name: string }, games: Array<{ id: string }> }> }).authorizations
    const authorization = mine.find((row) => row.games.some((game) => game.id === b.game.id))!
    expect(authorization.client.name).toBe('Assistant de test')

    expect((await api(bob, 'PUT', `/api/account/ai-authorizations/${authorization.id}`, { gameIds: [a.game.id] })).status).toBe(403)
    expect((await api(alice, 'PUT', `/api/account/ai-authorizations/${authorization.id}`, { gameIds: [] })).status).toBe(404)
    expect((await api(bob, 'PUT', `/api/account/ai-authorizations/${authorization.id}`, { gameIds: [] })).status).toBe(200)
    expect((await call(client, 'lister_jeux')).json).toEqual([])

    expect((await api(alice, 'DELETE', `/api/account/ai-authorizations/${authorization.id}`)).status).toBe(404)
    expect((await api(bob, 'DELETE', `/api/account/ai-authorizations/${authorization.id}`)).status).toBe(200)
    expect(await rawStatus(provider.saved!.access_token)).toBe(401)

    const log = (await api(bob, 'GET', '/api/account/ai-log')).body as Array<{ action: string }>
    expect(log.map((entry) => entry.action)).toEqual(expect.arrayContaining(['autorisation', 'modification', 'retrait']))
    const exported = (await api(bob, 'GET', '/api/account/export')).body as { aiAssistants: { log: unknown[] } }
    expect(exported.aiAssistants.log.length).toBeGreaterThan(0)
  })

  it('l’effacement du compte retire ses autorisations et garde le journal sans son nom', async () => {
    const leaving = await prisma.user.create({ data: { email: 'depart-ia@example.test', name: 'Départ', password: 'non-utilise', termsAcceptedVersion: TERMS_VERSION } })
    const gameId = (await prisma.game.create({ data: { title: 'Jeu du départ', slug: 'jeu-du-depart-ia', description: '', ownerId: bob.id } })).id
    await connectAssistant(leaving, { gameIds: [] })
    const authorization = await prisma.aiAuthorization.findFirstOrThrow({ where: { userId: leaving.id } })
    await prisma.aiLogEntry.create({ data: { userId: leaving.id, gameId, clientName: 'Assistant de test', action: 'outil', authorizationId: authorization.id } })

    await prisma.user.delete({ where: { id: leaving.id } })
    expect(await prisma.aiAuthorization.count({ where: { id: authorization.id } })).toBe(0)
    expect(await prisma.aiToken.count({ where: { authorizationId: authorization.id } })).toBe(0)
    const kept = await prisma.aiLogEntry.findMany({ where: { authorizationId: authorization.id, gameId } })
    expect(kept.map((entry) => entry.userId)).toEqual([null])
  })

  it('un compte qui n’a pas accepté les conditions en vigueur n’autorise pas', async () => {
    const outdated = await prisma.user.create({ data: { email: 'ancien-ia@example.test', name: 'Ancien', password: 'non-utilise', termsAcceptedVersion: 'ancienne' } })
    const provider = new TestProvider()
    await expect(new Client({ name: 'test', version: '1.0.0' }).connect(new StreamableHTTPClientTransport(mcpUrl, { authProvider: provider }))).rejects.toBeInstanceOf(UnauthorizedError)
    const requestId = (await fetch(provider.authUrl!, { redirect: 'manual' })).headers.get('location')!.split('/').pop()!
    expect((await api(outdated, 'GET', `/api/oauth/requests/${requestId}`)).status).toBe(403)
  })
})
