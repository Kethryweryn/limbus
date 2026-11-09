// US-188 : toute clé étrangère est couverte par un index, sans quoi une liste filtrée par elle et une suppression en
// cascade parcourent toute la table. Vaut pour les tables à venir.
import { afterAll, describe, expect, it } from 'vitest'
import { createTestPrisma } from './db'

const prisma = createTestPrisma()

afterAll(async () => {
  await prisma.$disconnect()
})

describe('schéma de données', () => {
  it('couvre chaque clé étrangère par un index qui commence par ses colonnes', async () => {
    const uncovered = await prisma.$queryRaw<Array<{ constraint: string }>>`
      SELECT c.conname AS "constraint"
      FROM pg_constraint c
      WHERE c.contype = 'f'
        AND c.connamespace = 'public'::regnamespace
        AND NOT EXISTS (
          SELECT 1 FROM pg_index i
          WHERE i.indrelid = c.conrelid
            -- Un index partiel ou sur une expression ne sert pas aux recherches sur toute la clé
            AND i.indpred IS NULL
            AND i.indexprs IS NULL
            AND (i.indkey::int2[])[0:cardinality(c.conkey) - 1] @> c.conkey
            AND (i.indkey::int2[])[0:cardinality(c.conkey) - 1] <@ c.conkey
        )
      ORDER BY 1`
    expect(uncovered.map((row) => row.constraint)).toEqual([])
  })

  // US-189 (ADR-0073) : les valeurs à liste fermée sont des énumérations de la base
  it('donne aux colonnes à liste fermée leur type énuméré', async () => {
    const expected: Array<[table: string, column: string, type: string]> = [
      ['Character', 'type', 'CharacterType'],
      ['CharacterRelation', 'type', 'CharacterRelationType'],
      ['Intrigue', 'level', 'IntrigueLevel'],
      ['Document', 'audience', 'DocumentAudience'],
      ['Document', 'audiences', '_DocumentRole'],
      ['Session', 'status', 'SessionStatus'],
      ['RegistrationPeriod', 'state', 'RegistrationPeriodState'],
      ['RegistrationPeriod', 'replayPolicy', 'ReplayPolicy'],
      ['RegistrationPeriodSession', 'selectionMode', 'SelectionMode'],
      ['Registration', 'status', 'RegistrationStatus'],
      ['Registration', 'source', 'RegistrationSource'],
      ['RegistrationSession', 'status', 'RegistrationSessionStatus'],
      ['RegistrationSession', 'answer', 'AvailabilityAnswer'],
      ['RegistrationSession', 'announcedStatus', 'RegistrationSessionStatus'],
      ['RegistrationSession', 'ignoredStatus', 'RegistrationSessionStatus'],
      ['RegistrationAffinity', 'kind', 'AffinityKind'],
      ['SessionParticipant', 'role', 'SessionRole'],
      ['SessionTariff', 'defaultRole', 'TariffRole'],
      ['SessionPayment', 'refundStatus', 'RefundStatus'],
      ['SessionDocumentDelivery', 'kind', 'DeliveryKind'],
      ['UploadedFile', 'kind', 'UploadKind'],
      ['User', 'role', 'UserRole'],
      ['AccountToken', 'kind', 'AccountTokenKind'],
      ['GameShare', 'role', 'GameShareRole'],
      ['GameInvitation', 'status', 'GameInvitationStatus'],
      ['GameInvitation', 'kind', 'GameInvitationKind'],
      ['SessionAttendance', 'status', 'AttendanceStatus'],
      ['AiToken', 'kind', 'AiTokenKind']
    ]
    const columns = await prisma.$queryRaw<Array<{ table: string, column: string, type: string }>>`
      SELECT table_name AS "table", column_name AS "column", udt_name AS "type"
      FROM information_schema.columns WHERE table_schema = 'public'`
    const typeOf = new Map(columns.map((row) => [`${row.table}.${row.column}`, row.type]))
    expect(expected.map(([table, column]) => [table, column, typeOf.get(`${table}.${column}`)])).toEqual(expected)
  })

  it('refuse une valeur hors liste', async () => {
    const session = await prisma.session.findFirstOrThrow({ select: { id: true, status: true } })
    // Valeur écrite en littéral, comme dans une migration : seule l'énumération peut la refuser
    await expect(prisma.$executeRawUnsafe(`UPDATE "Session" SET "status" = 'inconnu' WHERE "id" = $1`, session.id)).rejects.toThrow(/invalid input value for enum/)
    // Témoin : la même écriture avec une valeur de la liste passe
    await expect(prisma.$executeRawUnsafe(`UPDATE "Session" SET "status" = '${session.status}' WHERE "id" = $1`, session.id)).resolves.toBe(1)
    expect((await prisma.session.findUniqueOrThrow({ where: { id: session.id }, select: { status: true } })).status).toBe(session.status)
  })
})
