import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function createUser() {
  const email = 'kethryweryn@gmail.com'
  const password = '01240134'
  const name = 'Jean-Damien'
  const role = 'organizer'

  const hashedPassword = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      role
    }
  })

  console.log('✅ Utilisateur créé :', user)
}

createUser()
  .catch((e) => {
    console.error('❌ Erreur :', e)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
