import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function deleteUser() {
  const email = 'orga@limbus.gn'

  const deleted = await prisma.user.delete({
    where: { email }
  })

  console.log('🗑️ Utilisateur supprimé :', deleted)
}

deleteUser()
  .catch((e) => {
    console.error('❌ Erreur :', e)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
