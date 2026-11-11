// EPIC-024 : relations entre personnages (US-097), questionnaire relié aux rôles (US-098), relations refusées (US-099)
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import type { ApiResponse } from '~/composables/useApiFetch'
import { api, bodyOf, invalidMessages } from './api'
import { createTestPrisma } from './db'
import { startTestSmtp } from './smtp'

const prisma = createTestPrisma()
const { alice } = inject('world').users
let smtp: Awaited<ReturnType<typeof startTestSmtp>>
let counter = 0

beforeAll(async () => {
  smtp = await startTestSmtp(prisma)
})

afterAll(async () => {
  await smtp.stop()
  await prisma.$disconnect()
})

type Relation = ApiResponse<'/api/character-relations', 'post'>
type RegistrationDetail = ApiResponse<'/api/registrations/:id'>
const off = { asked: false, required: false }
const standardFields = { lastName: off, firstName: off, facebookName: off, phone: off, emergencyContact: off, dietary: off }

async function aliceGame() {
  const key = `relations-${++counter}`
  const game = await prisma.game.create({ data: { title: `Jeu ${key}`, slug: `jeu-${key}`, description: 'Un jeu', ownerId: alice.id } })
  const [ada, bran, cy] = await Promise.all(['Ada', 'Bran', 'Cy'].map((name) => prisma.character.create({
    data: { name, slug: `${key}-${name.toLowerCase()}`, gameId: game.id, sheetReadyToSend: true }
  })))
  return { key, game, ada: ada!, bran: bran!, cy: cy! }
}

const relation = (from: { id: string }, to: { id: string }, extra: Record<string, unknown> = {}) => ({
  type: 'family', fromCharacterId: from.id, toCharacterId: to.id, fromLabel: 'demi-sœur de', toLabel: 'demi-frère de', description: 'Brouillés depuis la guerre', ...extra
})

describe('relations entre personnages (US-097)', () => {
  it('relie deux personnages du jeu, visible des deux pages, et refuse un autre jeu ou soi-même', async () => {
    const { ada, bran } = await aliceGame()
    const other = await aliceGame()
    const created = await api(alice, 'POST', '/api/character-relations', relation(ada, bran, { fromVisible: true }))
    expect(created.status, JSON.stringify(created.body)).toBe(200)
    expect(created.body).toMatchObject({ type: 'family', fromCharacter: { name: 'Ada' }, toCharacter: { name: 'Bran' }, fromVisible: true, toVisible: false })

    expect(bodyOf<ApiResponse<'/api/characters/:id/relations'>>(await api(alice, 'GET', `/api/characters/${bran.id}/relations`)).map((row) => row.id)).toEqual([bodyOf<Relation>(created).id])
    expect((await api(alice, 'POST', '/api/character-relations', relation(ada, other.ada))).status).toBe(400)
    const self = await api(alice, 'POST', '/api/character-relations', relation(ada, ada))
    expect(self.status).toBe(400)
    expect(invalidMessages(self)).toEqual(['Un personnage ne peut pas être relié à lui-même'])
    expect((await api(alice, 'POST', '/api/character-relations', relation(ada, bran, { type: 'inconnu' }))).status).toBe(400)
  })

  // US-190 : plusieurs relations entre deux personnages, dans un sens ou dans l'autre
  it('garde plusieurs relations entre deux personnages, dans les deux sens', async () => {
    const { ada, bran } = await aliceGame()
    for (const body of [relation(ada, bran), relation(ada, bran, { type: 'rivalry' }), relation(bran, ada)]) {
      const created = await api(alice, 'POST', '/api/character-relations', body)
      expect(created.status, JSON.stringify(created.body)).toBe(200)
    }
    expect(await prisma.characterRelation.count({ where: { OR: [{ fromCharacterId: ada.id }, { toCharacterId: ada.id }] } })).toBe(3)
  })

  it('modifie avec la version lue, refuse une version dépassée, et supprime', async () => {
    const { ada, bran, cy } = await aliceGame()
    const created = bodyOf<Relation>(await api(alice, 'POST', '/api/character-relations', relation(ada, bran)))
    const updated = await api(alice, 'PUT', `/api/character-relations/${created.id}`, relation(ada, cy, { type: 'rivalry' }), { headers: { 'if-unmodified-since': created.updatedAt } })
    expect(updated.status, JSON.stringify(updated.body)).toBe(200)
    expect(updated.body).toMatchObject({ type: 'rivalry', toCharacter: { name: 'Cy' } })
    const stale = await api(alice, 'PUT', `/api/character-relations/${created.id}`, relation(ada, bran), { headers: { 'if-unmodified-since': '2000-01-01T00:00:00.000Z' } })
    expect(stale.status).toBe(409)

    expect((await api(alice, 'DELETE', `/api/character-relations/${created.id}`)).status).toBe(200)
    expect(await prisma.characterRelation.count({ where: { id: created.id } })).toBe(0)
  })

  it('supprimer un personnage supprime ses relations', async () => {
    const { ada, bran } = await aliceGame()
    const created = bodyOf<Relation>(await api(alice, 'POST', '/api/character-relations', relation(ada, bran)))
    expect((await api(alice, 'DELETE', `/api/characters/${bran.id}`)).status).toBe(200)
    expect(await prisma.characterRelation.count({ where: { id: created.id } })).toBe(0)
  })

  it('la fiche envoyée contient les relations visibles de son côté, et une fiche envoyée devient dépassée', async () => {
    const { key, game, ada, bran } = await aliceGame()
    const player = await prisma.participant.create({ data: { name: 'Joueuse', slug: `${key}-joueuse`, email: `${key}@example.test`, gameLinks: { create: { gameId: game.id } } } })
    const session = await prisma.session.create({
      data: { slug: `session-${key}`, gameId: game.id, assignments: { create: [{ characterId: ada.id, participantId: player.id }] } }
    })
    const sheetOf = async () => bodyOf<ApiResponse<'/api/sessions/:id/documents'>>(await api(alice, 'GET', `/api/sessions/${session.id}/documents`)).characterSheets.find((sheet) => sheet.character.id === ada.id)
    const before = await sheetOf()
    expect(before?.character.relationLines).toEqual([])

    // Visible côté Bran seulement : rien dans la fiche d'Ada
    const hidden = bodyOf<Relation>(await api(alice, 'POST', '/api/character-relations', relation(ada, bran, { toVisible: true })))
    expect((await sheetOf())?.sheetContentHash).toBe(before?.sheetContentHash)
    await api(alice, 'PUT', `/api/character-relations/${hidden.id}`, relation(ada, bran, { fromVisible: true }))
    const after = await sheetOf()
    expect(after?.character.relationLines).toEqual(['Bran — Famille, demi-sœur de : Brouillés depuis la guerre'])
    expect(after?.sheetContentHash).not.toBe(before?.sheetContentHash)
  })
})

describe('questionnaire relié aux rôles (US-098)', () => {
  async function withQuestions() {
    const setup = await aliceGame()
    const faction = await prisma.faction.create({ data: { name: 'Conseil', slug: `${setup.key}-conseil`, gameId: setup.game.id } })
    const saved = await api(alice, 'PUT', `/api/games/${setup.game.id}/registration-form`, {
      standardFields,
      questions: [
        { label: 'Votre jeu ?', type: 'single', required: false, options: ['Politique', 'Combat'] },
        { label: 'Romance ?', type: 'scale', required: false, options: [] },
        { label: 'Pourquoi ?', type: 'text', required: false, options: [] }
      ]
    })
    expect(saved.status, JSON.stringify(saved.body)).toBe(200)
    const [choice, scale, text] = bodyOf<ApiResponse<'/api/games/:id/registration-form', 'put'>>(saved).definition.questions
    return { ...setup, faction, choice: choice!, scale: scale!, text: text! }
  }

  it('enregistre les liens hors des versions, refuse une option inconnue ou un élément d’un autre jeu', async () => {
    const { game, ada, faction, choice, scale, text } = await withQuestions()
    const other = await aliceGame()
    const put = (links: unknown[]) => api(alice, 'PUT', `/api/games/${game.id}/registration-question-links`, { links })
    const saved = await put([
      { questionId: choice.id, option: 'Politique', factionId: faction.id },
      { questionId: choice.id, option: 'Politique', characterId: ada.id },
      { questionId: scale.id, option: '', characterId: ada.id }
    ])
    expect(saved.status, JSON.stringify(saved.body)).toBe(200)
    expect(bodyOf<ApiResponse<'/api/games/:id/registration-question-links', 'put'>>(saved).links).toHaveLength(3)
    expect(await prisma.registrationFormVersion.count({ where: { form: { gameId: game.id } } })).toBe(1)

    expect((await put([{ questionId: choice.id, option: 'Inconnue', characterId: ada.id }])).status).toBe(400)
    expect((await put([{ questionId: text.id, option: '', characterId: ada.id }])).status).toBe(400)
    expect((await put([{ questionId: choice.id, option: 'Combat', characterId: other.ada.id }])).status).toBe(400)
    // US-190 : sans cible ou à deux cibles, un message clair avant la base
    for (const link of [{ questionId: choice.id, option: 'Combat', characterId: ada.id, factionId: faction.id }, { questionId: choice.id, option: 'Combat' }]) {
      const refused = await put([link])
      expect(refused.status).toBe(400)
      expect(invalidMessages(refused)).toEqual(['Un lien vise un seul personnage, une faction ou une intrigue'])
    }

    const read = bodyOf<ApiResponse<'/api/games/:id/registration-question-links'>>(await api(alice, 'GET', `/api/games/${game.id}/registration-question-links`))
    expect(read.targets.characters.map((entry) => entry.name)).toEqual(['Ada', 'Bran', 'Cy'])
    expect(read.links).toHaveLength(3)
  })

  it('le détail d’une inscription donne les liens ; un lien vers une option retirée est ignoré', async () => {
    const { key, game, ada, choice, scale } = await withQuestions()
    await api(alice, 'PUT', `/api/games/${game.id}/registration-question-links`, { links: [
      { questionId: choice.id, option: 'Combat', characterId: ada.id },
      { questionId: scale.id, option: '', characterId: ada.id }
    ] })
    const participant = await prisma.participant.create({ data: { name: 'Lou', slug: `${key}-lou`, gameLinks: { create: { gameId: game.id } } } })
    const period = await prisma.registrationPeriod.create({ data: { gameId: game.id, publicId: key } })
    const registration = await prisma.registration.create({
      data: { gameId: period.gameId, periodId: period.id, participantId: participant.id, status: 'received', source: 'form', email: `${key}-lou@example.test`, respondedAt: new Date(), questionAnswers: { [choice.id]: 'Combat', [scale.id]: 4 } }
    })
    expect(bodyOf<RegistrationDetail>(await api(alice, 'GET', `/api/registrations/${registration.id}`)).questionLinks).toHaveLength(2)

    // L'option « Combat » disparaît : son lien n'est plus lu
    await api(alice, 'PUT', `/api/games/${game.id}/registration-form`, {
      standardFields, baseVersionNumber: 1,
      questions: [{ ...choice, options: ['Politique', 'Intrigue'] }, scale]
    })
    expect(bodyOf<RegistrationDetail>(await api(alice, 'GET', `/api/registrations/${registration.id}`)).questionLinks).toEqual([
      expect.objectContaining({ questionId: scale.id, option: '', target: { kind: 'character', id: ada.id, name: 'Ada' } })
    ])
  })

  it('la copie d’un jeu copie relations et liens, vers ses propres personnages', async () => {
    const { game, ada, bran, faction, choice } = await withQuestions()
    await api(alice, 'POST', '/api/character-relations', relation(ada, bran, { fromVisible: true }))
    await api(alice, 'PUT', `/api/games/${game.id}/registration-question-links`, { links: [{ questionId: choice.id, option: 'Politique', factionId: faction.id }] })
    expect((await api(alice, 'POST', `/api/games/${game.id}/bequests`, { email: 'bob@example.test' })).status).toBe(200)

    const copy = await prisma.game.findFirstOrThrow({ where: { copiedFromGameId: game.id }, include: { characterRelations: { include: { fromCharacter: true } }, registrationQuestionLinks: { include: { faction: true } } } })
    expect(copy.characterRelations).toHaveLength(1)
    expect(copy.characterRelations[0]).toMatchObject({ type: 'family', fromVisible: true, fromLabel: 'demi-sœur de' })
    expect(copy.characterRelations[0]!.fromCharacter.gameId).toBe(copy.id)
    expect(copy.registrationQuestionLinks).toHaveLength(1)
    expect(copy.registrationQuestionLinks[0]).toMatchObject({ questionId: choice.id, option: 'Politique' })
    expect(copy.registrationQuestionLinks[0]!.faction!.gameId).toBe(copy.id)
  })
})

// US-190 (ADR-0073) : la base tient elle-même ces règles, que le code vérifie avant d'écrire
describe('règles tenues par la base (US-190)', () => {
  it('refuse un lien du questionnaire sans cible ou à deux cibles', async () => {
    const { game, ada } = await aliceGame()
    const faction = await prisma.faction.create({ data: { name: 'Guilde', slug: `${game.slug}-guilde`, gameId: game.id } })
    const link = { gameId: game.id, questionId: 'q1', option: 'Combat' }
    await expect(prisma.registrationQuestionLink.create({ data: link })).rejects.toThrow(/RegistrationQuestionLink_une_cible_check/)
    await expect(prisma.registrationQuestionLink.create({ data: { ...link, characterId: ada.id, factionId: faction.id } })).rejects.toThrow(/RegistrationQuestionLink_une_cible_check/)
    // Témoin : une seule cible passe
    await expect(prisma.registrationQuestionLink.create({ data: { ...link, characterId: ada.id } })).resolves.toMatchObject({ characterId: ada.id })
  })

  it('refuse deux liens identiques, et garde deux liens qui diffèrent par la cible, l’option ou le jeu', async () => {
    const { game, ada, bran } = await aliceGame()
    const other = await aliceGame()
    const faction = await prisma.faction.create({ data: { name: 'Guilde', slug: `${game.slug}-guilde`, gameId: game.id } })
    const intrigue = await prisma.intrigue.create({ data: { name: 'Complot', slug: `${game.slug}-complot`, gameId: game.id } })
    const link = { gameId: game.id, questionId: 'q1', option: 'Combat' }
    for (const [index, target] of [['personnage', { characterId: ada.id }], ['groupe', { factionId: faction.id }], ['intrigue', { intrigueId: intrigue.id }]] as const) {
      await prisma.registrationQuestionLink.create({ data: { ...link, ...target } })
      // L'index de la sorte de cible refuse le doublon : l'erreur le nomme
      const duplicate = await prisma.registrationQuestionLink.create({ data: { ...link, ...target } }).then(() => null, (error: { code?: string, meta?: unknown }) => error)
      expect(duplicate?.code).toBe('P2002')
      expect(JSON.stringify(duplicate?.meta)).toContain(`RegistrationQuestionLink_${index}_unique_key`)
    }
    // Témoins : autre cible, autre option, même question dans la copie d'un jeu
    await prisma.registrationQuestionLink.createMany({ data: [
      { ...link, characterId: bran.id },
      { ...link, option: 'Politique', characterId: ada.id },
      { ...link, gameId: other.game.id, characterId: other.ada.id }
    ] })
    expect(await prisma.registrationQuestionLink.count({ where: { questionId: 'q1', gameId: { in: [game.id, other.game.id] } } })).toBe(6)
  })

  it('l’enregistrement des liens ne garde qu’un exemplaire d’un lien envoyé deux fois', async () => {
    const { game, ada } = await aliceGame()
    const saved = await api(alice, 'PUT', `/api/games/${game.id}/registration-form`, {
      standardFields, questions: [{ label: 'Votre jeu ?', type: 'single', required: false, options: ['Politique', 'Combat'] }]
    })
    const [choice] = bodyOf<ApiResponse<'/api/games/:id/registration-form', 'put'>>(saved).definition.questions
    const twice = { questionId: choice!.id, option: 'Combat', characterId: ada.id }
    const put = await api(alice, 'PUT', `/api/games/${game.id}/registration-question-links`, { links: [twice, twice] })
    expect(put.status, JSON.stringify(put.body)).toBe(200)
    expect(await prisma.registrationQuestionLink.count({ where: { gameId: game.id } })).toBe(1)
  })

  it('refuse une relation d’un personnage avec lui-même', async () => {
    const { game, ada, bran } = await aliceGame()
    const data = { gameId: game.id, type: 'family' as const, fromCharacterId: ada.id, toCharacterId: ada.id }
    await expect(prisma.characterRelation.create({ data })).rejects.toThrow(/CharacterRelation_deux_personnages_check/)
    const kept = await prisma.characterRelation.create({ data: { ...data, toCharacterId: bran.id } })
    await expect(prisma.characterRelation.update({ where: { id: kept.id }, data: { toCharacterId: ada.id } })).rejects.toThrow(/CharacterRelation_deux_personnages_check/)
  })
})
