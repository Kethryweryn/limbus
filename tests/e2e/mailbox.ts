import { appendFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { listenTestSmtp, saveTestSmtpSettings, type ReceivedEmail } from '../integration/smtp'
import type { TestPrisma } from './helpers'

// Un seul serveur SMTP pour toute la série, car l'application n'a qu'un réglage SMTP. Il écrit chaque message
// dans un fichier, que les tests lisent depuis leurs processus (workers). Le chemin passe par l'environnement,
// que les workers reçoivent du globalSetup.
export async function startSharedSmtp(prisma: TestPrisma) {
  const path = join(tmpdir(), `limbus-e2e-emails-${process.pid}.jsonl`)
  writeFileSync(path, '')
  process.env.E2E_MAILBOX = path
  const server = await listenTestSmtp((email) => appendFileSync(path, `${JSON.stringify(email)}\n`))
  await saveTestSmtpSettings(prisma, server.port)
  return async () => {
    await server.close()
    rmSync(path, { force: true })
  }
}

// Messages complets du fichier : une ligne en cours d'écriture n'a pas encore son retour à la ligne final
function allEmails(): ReceivedEmail[] {
  return readFileSync(process.env.E2E_MAILBOX!, 'utf8').split('\n').slice(0, -1).map((line) => JSON.parse(line) as ReceivedEmail)
}

// Boîte d'un test : les emails arrivés depuis son ouverture, par destinataire. Les tests tournent en parallèle :
// chacun écrit à des adresses qui lui sont propres, et une relance (retries) ne voit pas les emails de la précédente.
export function openMailbox() {
  const start = allEmails().length
  return {
    to: (email: string) => allEmails().slice(start).filter((message) => message.to.includes(email))
  }
}
