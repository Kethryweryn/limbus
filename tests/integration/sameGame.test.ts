// US-191, US-195 (ADR-0074, ADR-0077) : la base refuse un lien entre éléments de deux jeux, chaque clé étrangère
// comparant aussi le jeu
import { afterAll, describe, expect, inject, it } from 'vitest'
import { api, errorMessage } from './api'
import { createTestPrisma } from './db'

const prisma = createTestPrisma()
const { alice } = inject('world').users
let counter = 0

afterAll(async () => {
  await prisma.$disconnect()
})

/** Un jeu d'Alice avec un élément de chaque sorte, une session, un lieu, un vivier, un formulaire et une inscription. */
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
  const [session, location, period, form, participant] = await Promise.all([
    prisma.session.create({ data: { name: 'Session', slug: `${key}-session`, gameId } }),
    prisma.location.create({ data: { name: 'Château', slug: `${key}-chateau`, gameId } }),
    prisma.registrationPeriod.create({ data: { gameId, publicId: `${key}-vivier` } }),
    prisma.registrationForm.create({ data: { gameId, versions: { create: { number: 1, definition: {} } } }, include: { versions: true } }),
    prisma.participant.create({ data: { name: 'Lou', slug: `${key}-lou`, gameLinks: { create: { gameId } } } })
  ])
  const registration = await prisma.registration.create({
    data: { gameId, periodId: period.id, participantId: participant.id, status: 'received', source: 'form', email: `${key}@example.test` }
  })
  return { key, gameId, character, other, faction, intrigue, item, document, timelineEvent, session, location, period, form, version: form.versions[0]!, participant, registration }
}

type Content = Awaited<ReturnType<typeof gameWithContent>>
const FOREIGN_KEY = /Foreign key constraint violated|violates foreign key constraint/

describe('liens entre éléments de deux jeux (US-191, US-195)', () => {
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
    // US-195 : sessions, vivier, paiements et fichiers
    ['lieu d’une session', (a, b) => prisma.session.update({ where: { id: a.session.id }, data: { locationId: b.location.id } })],
    ['session de report', (a, b) => prisma.session.update({ where: { id: a.session.id }, data: { postponedToSessionId: b.session.id } })],
    ['casting', (a, b) => prisma.sessionAssignment.create({ data: { gameId: a.gameId, sessionId: a.session.id, characterId: b.character.id } })],
    ['place réservée', (a, b) => prisma.sessionAssignment.create({ data: { gameId: a.gameId, sessionId: a.session.id, characterId: a.other.id, reservedRegistrationId: b.registration.id } })],
    ['responsable du déroulé', (a, b) => prisma.timelineEventResponsible.create({ data: { gameId: a.gameId, sessionId: a.session.id, timelineEventId: b.timelineEvent.id, participantId: a.participant.id } })],
    ['envoi d’un document', (a, b) => prisma.sessionDocumentDelivery.create({ data: { gameId: a.gameId, sessionId: a.session.id, participantId: a.participant.id, documentId: b.document.id, kind: 'document' } })],
    ['envoi d’une fiche', (a, b) => prisma.sessionDocumentDelivery.create({ data: { gameId: a.gameId, sessionId: a.session.id, participantId: a.participant.id, characterId: b.character.id, kind: 'character_sheet' } })],
    ['trombinoscope de session', (a, b) => prisma.sessionTrombinoscope.create({ data: { gameId: a.gameId, sessionId: a.session.id, viewerCharacterId: b.character.id, participantId: a.participant.id, fileName: 't.pdf', contentHtml: '' } })],
    ['session du vivier', (a, b) => prisma.registrationPeriodSession.create({ data: { gameId: a.gameId, periodId: a.period.id, sessionId: b.session.id } })],
    ['tirage', (a, b) => prisma.registrationDraw.create({ data: { gameId: a.gameId, periodId: a.period.id, sessionId: b.session.id, seed: 's', settings: {}, result: {} } })],
    ['inscription au vivier', async (a, b) => {
      const participant = await prisma.participant.create({ data: { name: 'Max', slug: `${a.key}-max-${++counter}` } })
      return await prisma.registration.create({ data: { gameId: a.gameId, periodId: b.period.id, participantId: participant.id, status: 'received', source: 'form', email: `${a.key}-bis@example.test` } })
    }],
    ['session d’une invitation', (a, b) => prisma.registration.update({ where: { id: a.registration.id }, data: { invitedSessionId: b.session.id } })],
    ['version du formulaire d’une inscription', (a, b) => prisma.registration.update({ where: { id: a.registration.id }, data: { formVersionId: b.version.id } })],
    ['version du formulaire d’une demande', (a, b) => prisma.registrationRequest.create({ data: { gameId: a.gameId, periodId: a.period.id, email: 'demande@example.test', answers: {}, formVersionId: b.version.id, tokenHash: `${a.key}-${b.key}` } })],
    ['version d’un formulaire', (a, b) => prisma.registrationFormVersion.create({ data: { gameId: a.gameId, formId: b.form.id, number: 2, definition: {} } })],
    ['ligne d’inscription', (a, b) => prisma.registrationSession.create({ data: { gameId: a.gameId, registrationId: a.registration.id, sessionId: b.session.id, status: 'preregistered' } })],
    ['report d’un paiement', (a, b) => prisma.sessionPayment.create({ data: { gameId: a.gameId, sessionId: a.session.id, participantId: a.participant.id, carriedOverToSessionId: b.session.id } })],
    ['fichier d’une session', (a, b) => prisma.uploadedFile.create({ data: { kind: 'sessionPaymentRib', filename: `${a.key}-${b.key}.pdf`, url: `/rib/${a.key}-${b.key}`, gameId: a.gameId, sessionId: b.session.id } })]
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

  // ADR-0077 : la base n'efface que l'identifiant ; la ligne garde son jeu et reste
  it('supprimer la cible d’une référence facultative la vide, sans toucher au reste de la ligne', async () => {
    const a = await gameWithContent()
    const later = await prisma.session.create({ data: { name: 'Reportée', slug: `${a.key}-reportee`, gameId: a.gameId } })
    await prisma.session.update({ where: { id: a.session.id }, data: { locationId: a.location.id, postponedToSessionId: later.id } })
    const assignment = await prisma.sessionAssignment.create({ data: { gameId: a.gameId, sessionId: a.session.id, characterId: a.character.id, reservedRegistrationId: a.registration.id } })
    const draw = await prisma.registrationDraw.create({ data: { gameId: a.gameId, periodId: a.period.id, sessionId: later.id, seed: 's', settings: {}, result: {} } })
    await prisma.registration.update({ where: { id: a.registration.id }, data: { invitedSessionId: later.id, formVersionId: a.version.id } })
    const payment = await prisma.sessionPayment.create({ data: { gameId: a.gameId, sessionId: a.session.id, participantId: a.participant.id, carriedOverToSessionId: later.id } })

    expect((await api(alice, 'DELETE', `/api/locations/${a.location.id}`)).status).toBe(200)
    await prisma.session.delete({ where: { id: later.id } })
    expect(await prisma.session.findUniqueOrThrow({ where: { id: a.session.id }, select: { gameId: true, locationId: true, postponedToSessionId: true } }))
      .toEqual({ gameId: a.gameId, locationId: null, postponedToSessionId: null })
    expect(await prisma.registrationDraw.findUniqueOrThrow({ where: { id: draw.id }, select: { gameId: true, sessionId: true } })).toEqual({ gameId: a.gameId, sessionId: null })
    expect(await prisma.sessionPayment.findUniqueOrThrow({ where: { id: payment.id }, select: { gameId: true, carriedOverToSessionId: true } })).toEqual({ gameId: a.gameId, carriedOverToSessionId: null })
    expect(await prisma.registration.findUniqueOrThrow({ where: { id: a.registration.id }, select: { invitedSessionId: true } })).toEqual({ invitedSessionId: null })

    // Une inscription supprimée en cascade, par l'effacement de la personne, libère le personnage réservé
    await prisma.registrationFormVersion.delete({ where: { id: a.version.id } })
    expect(await prisma.registration.findUniqueOrThrow({ where: { id: a.registration.id }, select: { formVersionId: true } })).toEqual({ formVersionId: null })
    await prisma.participant.delete({ where: { id: a.participant.id } })
    expect(await prisma.sessionAssignment.findUniqueOrThrow({ where: { id: assignment.id }, select: { gameId: true, reservedRegistrationId: true } })).toEqual({ gameId: a.gameId, reservedRegistrationId: null })
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
    expect(rows.map((row) => row.constraint)).toEqual([])
  })

  // ADR-0077 : une clé qui se vide n'efface que son identifiant, jamais le jeu ; Prisma écrirait ON DELETE SET NULL sur
  // toutes les colonnes et la suppression échouerait
  it('n’efface que l’identifiant quand une clé composée avec le jeu se vide', async () => {
    const rows = await prisma.$queryRaw<Array<{ constraint: string, columns: string[] | null }>>`
      SELECT c.conname AS "constraint",
        (SELECT array_agg(a.attname::text ORDER BY a.attname) FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = ANY (c.confdelsetcols)) AS "columns"
      FROM pg_constraint c
      WHERE c.contype = 'f'
        AND c.connamespace = 'public'::regnamespace
        AND c.confdeltype = 'n'
        AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey) AND a.attname = 'gameId' AND a.attnotnull)
      ORDER BY 1`
    expect(rows.map((row) => row.constraint)).toEqual([
      'Item_locationCharacterId_gameId_fkey',
      'RegistrationDraw_sessionId_gameId_fkey',
      'RegistrationRequest_formVersionId_gameId_fkey',
      'Registration_formVersionId_gameId_fkey',
      'Registration_invitedSessionId_gameId_fkey',
      'SessionAssignment_reservedRegistrationId_gameId_fkey',
      'SessionPayment_carriedOverToSessionId_gameId_fkey',
      'Session_locationId_gameId_fkey',
      'Session_postponedToSessionId_gameId_fkey'
    ])
    expect(rows.filter((row) => !row.columns?.length || row.columns.includes('gameId')).map((row) => row.constraint)).toEqual([])
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
      GROUP BY c.conrelid
      HAVING count(*) >= 2
      ORDER BY 1`
    expect(rows.map((row) => row.table)).toEqual([])
  })
})
