// Crée un utilisateur, ou redéfinit son mot de passe s'il existe déjà.
// Usage : npm run user:create
// Le mot de passe est saisi au clavier (masqué) et n'apparaît ni dans le code ni dans l'historique du shell.
import 'dotenv/config'
import { createInterface } from 'node:readline'
import bcrypt from 'bcrypt'
import { prisma } from '../server/utils/prisma'
import { USER_ROLES } from '../utils/domain'

const MIN_PASSWORD_LENGTH = 12

function ask(question: string, hidden = false): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  if (hidden) {
    // N'affiche rien pendant la saisie du mot de passe
    ;(rl as any)._writeToOutput = (text: string) => {
      if (text.startsWith(question)) process.stdout.write(question)
    }
  }

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      if (hidden) process.stdout.write('\n')
      resolve(answer.trim())
    })
  })
}

async function main() {
  const email = (await ask('Email : ')).toLowerCase()
  if (!email.includes('@')) throw new Error('Email invalide')

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } })

  const name = existing ? '' : await ask('Nom : ')
  const roleAnswer = existing ? existing.role : (await ask('Rôle (admin/organizer) [organizer] : ')) || USER_ROLES.organizer
  if (!([USER_ROLES.admin, USER_ROLES.organizer] as string[]).includes(roleAnswer)) throw new Error('Rôle invalide')

  const password = await ask('Mot de passe : ', true)
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères`)
  }
  if (password !== await ask('Confirmation : ', true)) throw new Error('Les mots de passe ne correspondent pas')

  const hashedPassword = await bcrypt.hash(password, 12)

  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { password: hashedPassword } })
    console.log(`Mot de passe mis à jour pour ${email}`)
  } else {
    await prisma.user.create({ data: { email, name, role: roleAnswer, password: hashedPassword } })
    console.log(`Utilisateur créé : ${email} (${roleAnswer})`)
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
