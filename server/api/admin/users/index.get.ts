import { prisma } from '~/server/utils/prisma'
import { notActivatedAccount } from '~/server/utils/participantAccounts'
import { requireAdmin } from '~/server/utils/auth'
import { storageUsedBytesByOwner } from '~/server/utils/uploads'

// Comptes de Limbus. Les comptes non activés (US-248), aussi nombreux que les fiches à adresse, ne sont renvoyés que sur
// demande (?inactifs=1) : par défaut, seulement leur nombre
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const withInactive = getQuery(event).inactifs === '1'

  const [users, inactiveCount] = await Promise.all([prisma.user.findMany({
    where: withInactive ? undefined : { NOT: notActivatedAccount },
    orderBy: [{ role: 'asc' }, { email: 'asc' }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailConfirmedAt: true,
      disabledAt: true,
      storageQuotaMb: true,
      createdAt: true,
      updatedAt: true,
      ownedGames: {
        select: { id: true, title: true, slug: true },
        orderBy: { title: 'asc' }
      },
      gameShares: {
        include: {
          game: { select: { id: true, title: true, slug: true } }
        }
      }
    }
  }), prisma.user.count({ where: notActivatedAccount })])
  // Espace utilisé par compte (US-066)
  const usage = await storageUsedBytesByOwner()
  return { users: users.map((user) => ({ ...user, storageUsedBytes: usage.get(user.id) ?? 0 })), inactiveCount }
})
