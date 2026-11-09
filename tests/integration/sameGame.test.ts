// US-191 (ADR-0074) : la base refuse un lien entre éléments de deux jeux, chaque clé étrangère comparant aussi le jeu
import { afterAll, describe, expect, inject, it } from 'vitest'
import { api, errorMessage } from './api'
import { createTestPrisma } from './db'

const prisma = createTestPrisma()
const { alice } = inject('world').users
let counter = 0

afterAll(async () => {
  await prisma.$disconnect()
})

/** Un jeu d'Alice avec un élément de chaque sorte. */
async function gameWithContent() {
  const key = `meme-jeu-${++counter}-${Date.now()}`
  const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: 'Un jeu', ownerId: alice.id } })
  const gameId = game.id
  const [character, other, faction, intrigue, item, document, timelineEvent] = await Promise.all([
    prisma.character.create({ data: { name: 'Ada', slug: `${key}-ada`, gameId } }),
    prisma.character.create({ data: { name: 'Bran', slug: `${key}-bran`, gameId } }),
    prisma.faction.create({ data: { name: 'Guilde', slug: `${key}-guilde`, gameId } }),
    prisma.intrigue.create({ data: { name: 'Complot', slug: `${key}-complot`, gameId } }),
    prisma.item.create({ data: { name: 'Dague', slug: `${key}-dague`, gameId } }),
    prisma.document.create({ data: { title: 'Lettre', slug: `${key}-lettre`, gameId } }),
    prisma.timelineEvent.create({ data: { name: 'Bal', slug: `${key}-bal`, gameId, day: 1, time: '20:00' } })
  ])
  return { gameId, character, other, faction, intrigue, item, document, timelineEvent }
}

type Content = Awaited<ReturnType<typeof gameWithContent>>
const FOREIGN_KEY = /Foreign key constraint violated|violates foreign key constraint/

describe('liens entre éléments de deux jeux (US-191)', () => {
  // Chaque lien : l'écriture à partir de l'élément du premier jeu vers un élément de l'autre
  const links: Array<[name: string, write: (a: Content, b: Content) => Promise<unknown>]> = [
    ['personnage ↔ groupe', (a, b) => prisma.characterFaction.create({ data: { gameId: a.gameId, characterId: a.character.id, factionId: b.faction.id } })],
    ['personnage ↔ intrigue', (a, b) => prisma.characterIntrigue.create({ data: { gameId: a.gameId, characterId: a.character.id, intrigueId: b.intrigue.id } })],
    ['personnage ↔ objet', (a, b) => prisma.characterItem.create({ data: { gameId: a.gameId, characterId: a.character.id, itemId: b.item.id } })],
    ['document ↔ personnage', (a, b) => prisma.documentCharacter.create({ data: { gameId: a.gameId, documentId: a.document.id, characterId: b.character.id } })],
    ['document ↔ groupe', (a, b) => prisma.documentFaction.create({ data: { gameId: a.gameId, documentId: a.document.id, factionId: b.faction.id } })],
    ['groupe ↔ intrigue', (a, b) => prisma.factionIntrigue.create({ data: { gameId: a.gameId, factionId: a.faction.id, intrigueId: b.intrigue.id } })],
    ['intrigue ↔ objet', (a, b) => prisma.intrigueItem.create({ data: { gameId: a.gameId, intrigueId: a.intrigue.id, itemId: b.item.id } })],
    ['événement ↔ personnage', (a, b) => prisma.timelineEventCharacter.create({ data: { gameId: a.gameId, timelineEventId: a.timelineEvent.id, characterId: b.character.id } })],
    ['événement ↔ groupe', (a, b) => prisma.timelineEventFaction.create({ data: { gameId: a.gameId, timelineEventId: a.timelineEvent.id, factionId: b.faction.id } })],
    ['événement ↔ intrigue', (a, b) => prisma.timelineEventIntrigue.create({ data: { gameId: a.gameId, timelineEventId: a.timelineEvent.id, intrigueId: b.intrigue.id } })],
    ['événement ↔ objet', (a, b) => prisma.timelineEventItem.create({ data: { gameId: a.gameId, timelineEventId: a.timelineEvent.id, itemId: b.item.id } })],
    ['relation entre personnages', (a, b) => prisma.characterRelation.create({ data: { gameId: a.gameId, type: 'family', fromCharacterId: a.character.id, toCharacterId: b.other.id } })],
    ['lien du questionnaire', (a, b) => prisma.registrationQuestionLink.create({ data: { gameId: a.gameId, questionId: 'q1', characterId: b.character.id } })],
    ['case du trombinoscope', (a, b) => prisma.characterTrombinoscopeEntry.create({ data: { gameId: a.gameId, viewerCharacterId: a.character.id, targetCharacterId: b.other.id } })],
    ['objet porté par un personnage', (a, b) => prisma.item.update({ where: { id: a.item.id }, data: { locationCharacterId: b.character.id } })],
    ['ancien personnage d’un document', (a, b) => prisma.document.update({ where: { id: a.document.id }, data: { characterId: b.character.id } })]
  ]

  it.each(links)('%s : refusé entre deux jeux, accepté dans le même', async (_name, write) => {
    const [a, b] = await Promise.all([gameWithContent(), gameWithContent()])
    await expect(write(a, b)).rejects.toThrow(FOREIGN_KEY)
    // Témoin : le même lien dans un seul jeu passe
    await expect(write(a, a)).resolves.toBeTruthy()
  })

  it('refuse de faire changer de jeu un élément relié', async () => {
    const [a, b] = await Promise.all([gameWithContent(), gameWithContent()])
    await prisma.characterFaction.create({ data: { gameId: a.gameId, characterId: a.character.id, factionId: a.faction.id } })
    await expect(prisma.character.update({ where: { id: a.character.id }, data: { gameId: b.gameId } })).rejects.toThrow(FOREIGN_KEY)
  })

  it('un élément relié donné deux fois n’est relié qu’une fois, et un élément d’un autre jeu est refusé avec son message', async () => {
    const [a, b] = await Promise.all([gameWithContent(), gameWithContent()])
    const twice = await api(alice, 'POST', '/api/characters', { name: 'Cy', gameId: a.gameId, factionIds: [a.faction.id, a.faction.id] })
    expect(twice.status, JSON.stringify(twice.body)).toBe(200)
    expect(await prisma.characterFaction.count({ where: { factionId: a.faction.id } })).toBe(1)
    const foreign = await api(alice, 'POST', '/api/characters', { name: 'Dee', gameId: a.gameId, factionIds: [b.faction.id] })
    expect(foreign.status).toBe(400)
    expect(errorMessage(foreign)).toBe('Groupes invalides pour ce jeu')
  })

  it('supprimer un personnage vide l’objet qu’il porte, sans supprimer l’objet', async () => {
    const a = await gameWithContent()
    await prisma.item.update({ where: { id: a.item.id }, data: { locationCharacterId: a.character.id } })
    expect((await api(alice, 'DELETE', `/api/characters/${a.character.id}`)).status).toBe(200)
    expect(await prisma.item.findUniqueOrThrow({ where: { id: a.item.id }, select: { locationCharacterId: true } })).toEqual({ locationCharacterId: null })
  })

  it('supprimer un jeu supprime son contenu et ses liens', async () => {
    const a = await gameWithContent()
    await prisma.item.update({ where: { id: a.item.id }, data: { locationCharacterId: a.character.id } })
    await prisma.characterFaction.create({ data: { gameId: a.gameId, characterId: a.character.id, factionId: a.faction.id } })
    expect((await api(alice, 'DELETE', `/api/games/${a.gameId}`)).status).toBe(200)
    expect(await prisma.characterFaction.count({ where: { gameId: a.gameId } })).toBe(0)
    expect(await prisma.item.count({ where: { gameId: a.gameId } })).toBe(0)
  })

  // Vaut pour les tables à venir : une clé étrangère entre deux tables qui portent le jeu le compare
  it('compare le jeu dans chaque clé étrangère entre deux tables qui le portent', async () => {
    const rows = await prisma.$queryRaw<Array<{ constraint: string }>>`
      SELECT c.conname AS "constraint"
      FROM pg_constraint c
      JOIN pg_attribute own ON own.attrelid = c.conrelid AND own.attname = 'gameId'
      JOIN pg_attribute target ON target.attrelid = c.confrelid AND target.attname = 'gameId'
      WHERE c.contype = 'f'
        AND c.connamespace = 'public'::regnamespace
        AND c.confrelid <> '"Game"'::regclass
        AND NOT (own.attnum = ANY (c.conkey))
      ORDER BY 1`
    // Sessions, vivier, paiements et fichiers : US-195
    expect(rows.map((row) => row.constraint)).toEqual([
      'Session_locationId_fkey',
      'Session_postponedToSessionId_fkey',
      'UploadedFile_sessionId_fkey'
    ])
  })

  // Une table qui relie deux éléments d'un jeu porte elle-même le jeu, sans quoi le contrôle ci-dessus ne la voit pas
  it('donne le jeu à chaque table qui relie deux éléments d’un jeu', async () => {
    const rows = await prisma.$queryRaw<Array<{ table: string }>>`
      SELECT c.conrelid::regclass::text AS "table"
      FROM pg_constraint c
      JOIN pg_attribute target ON target.attrelid = c.confrelid AND target.attname = 'gameId' AND NOT target.attisdropped
      WHERE c.contype = 'f'
        AND c.connamespace = 'public'::regnamespace
        AND c.confrelid <> '"Game"'::regclass
        AND NOT EXISTS (SELECT 1 FROM pg_attribute own WHERE own.attrelid = c.conrelid AND own.attname = 'gameId' AND NOT own.attisdropped)
        -- Anciennes tables de liaison implicites, gardées jusqu'à l'US-193
        AND left(c.conrelid::regclass::text, 2) <> '"_'
      GROUP BY c.conrelid
      HAVING count(*) >= 2
      ORDER BY 1`
    // US-195
    expect(rows.map((row) => row.table)).toEqual([
      '"Registration"', '"RegistrationDraw"', '"RegistrationPeriodSession"', '"SessionAssignment"',
      '"SessionDocumentDelivery"', '"SessionPayment"', '"SessionTrombinoscope"', '"TimelineEventResponsible"'
    ])
  })
})
