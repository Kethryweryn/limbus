import { execFileSync } from 'node:child_process'
import bcrypt from 'bcrypt'
import { createTestPrisma, testDatabaseUrl } from '../integration/db'
import { E2E_PASSWORD, E2E_USERS } from './constants'

export default async function globalSetup() {
  execFileSync('npx', ['prisma', 'migrate', 'reset', '--force'], {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    stdio: 'pipe',
    shell: process.platform === 'win32'
  })

  const prisma = createTestPrisma()
  const password = await bcrypt.hash(E2E_PASSWORD, 4)
  const users = await Promise.all(Object.values(E2E_USERS).map((email) =>
    prisma.user.create({ data: { email, name: email.split('@')[0]!, password } })
  ))

  await prisma.game.create({
    data: { title: 'Jeu avec teaser', slug: 'jeu-teaser', description: '', publicPage: true, ownerId: users[0]!.id, teaserUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
  })
  // Valeur dangereuse écrite directement en base (l'API la refuse) : le front ne doit pas l'exécuter
  await prisma.game.create({
    data: { title: 'Jeu piégé', slug: 'jeu-piege', description: '', publicPage: true, ownerId: users[0]!.id, teaserUrl: 'javascript:alert(document.domain)' }
  })
  // Parcours d'inscription sur invitation (US-004) : une période ouverte et une participante avec email
  const registrationGame = await prisma.game.create({
    data: { title: 'Jeu des inscriptions', slug: 'jeu-inscriptions', description: '', noteIntention: 'Jouer ensemble, avec bienveillance.', ownerId: users[0]!.id }
  })
  const registrationSession = await prisma.session.create({
    data: { name: 'Session de printemps', slug: 'session-printemps', gameId: registrationGame.id, date: new Date('2099-04-10T09:00:00Z') }
  })
  await prisma.registrationPeriod.create({
    data: { name: 'Inscriptions de printemps', gameId: registrationGame.id, publicId: 'e2e-printemps', state: 'open', sessions: { create: { sessionId: registrationSession.id, seats: 3 } } }
  })
  await prisma.participant.create({
    data: { name: 'Camille Invitée', slug: 'camille-invitee', email: 'camille.invitee@example.test', gameLinks: { create: { gameId: registrationGame.id } } }
  })
  await prisma.$disconnect()
}
