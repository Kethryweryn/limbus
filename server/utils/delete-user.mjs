import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function deleteUser() {
  const email = 'kethryweryn@gmail.com'

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
