import { createServer, type Server } from 'node:net'
import type { PrismaClient } from '~/generated/prisma/client'

export type ReceivedEmail = { to: string[], raw: string, text: string }

// Corps lisible : les emails partent en quoted-printable ou en base64 selon leur contenu.
// Avec une pièce jointe (multipart), on lit la partie texte.
function decodeBody(raw: string): string {
  const separator = raw.indexOf('\r\n\r\n')
  const headers = raw.slice(0, separator)
  const body = raw.slice(separator + 4)
  const boundary = /content-type:\s*multipart\/[^;]+;\s*boundary="?([^"\r\n;]+)"?/i.exec(headers)?.[1]
  if (boundary) {
    const parts = body.split(`--${boundary}`).slice(1)
    const text = parts.find((part) => /content-type:\s*text\/plain/i.test(part.slice(0, part.indexOf('\r\n\r\n'))))
    return text ? decodeBody(text.replace(/^\r\n/, '').replace(/\r\n$/, '')) : body
  }
  if (/content-transfer-encoding:\s*base64/i.test(headers)) {
    return Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8')
  }
  if (/content-transfer-encoding:\s*quoted-printable/i.test(headers)) {
    const bytes = body.replace(/=\r\n/g, '').replace(/=([0-9A-F]{2})/gi, (_match, hex) => `%${hex}`)
    return decodeURIComponent(bytes)
  }
  return body
}

/**
 * Serveur SMTP minimal, en clair et sans authentification, qui garde les messages reçus.
 * L'application compilée (processus séparé) y envoie via les réglages SMTP de la base.
 */
export async function startTestSmtp(prisma: PrismaClient) {
  const received: ReceivedEmail[] = []

  const server: Server = createServer((socket) => {
    let buffer = ''
    let inData = false
    let recipients: string[] = []
    socket.write('220 smtp.test ESMTP\r\n')

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8')
      while (true) {
        if (inData) {
          const end = buffer.indexOf('\r\n.\r\n')
          if (end === -1) return
          const raw = buffer.slice(0, end).replace(/^\.\./gm, '.')
          buffer = buffer.slice(end + 5)
          inData = false
          received.push({ to: recipients, raw, text: decodeBody(raw) })
          recipients = []
          socket.write('250 OK\r\n')
          continue
        }

        const lineEnd = buffer.indexOf('\r\n')
        if (lineEnd === -1) return
        const line = buffer.slice(0, lineEnd)
        buffer = buffer.slice(lineEnd + 2)
        const command = line.slice(0, 4).toUpperCase()

        if (command === 'EHLO' || command === 'HELO') socket.write('250 smtp.test\r\n')
        else if (command === 'RCPT') {
          const recipient = line.match(/<([^>]+)>/)?.[1] || ''
          // Une adresse « refuse… » est rejetée, pour tester un échec d'envoi à une personne
          if (recipient.startsWith('refuse')) {
            socket.write('550 Destinataire refusé\r\n')
            continue
          }
          recipients.push(recipient)
          socket.write('250 OK\r\n')
        } else if (command === 'DATA') {
          inData = true
          socket.write('354 Fin par <CRLF>.<CRLF>\r\n')
        } else if (command === 'QUIT') {
          socket.end('221 Bye\r\n')
          return
        } else socket.write('250 OK\r\n')
      }
    })
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0

  const settings = { enabled: true, host: '127.0.0.1', port, secure: false, username: null, passwordEncrypted: null, fromEmail: 'limbus@example.test', fromName: 'Limbus' }
  await prisma.smtpSettings.upsert({ where: { id: 'default' }, create: { id: 'default', ...settings }, update: settings })

  return {
    received,
    async disable() {
      await prisma.smtpSettings.update({ where: { id: 'default' }, data: { enabled: false } })
    },
    async enable() {
      await prisma.smtpSettings.update({ where: { id: 'default' }, data: { enabled: true } })
    },
    async stop() {
      await prisma.smtpSettings.deleteMany({ where: { id: 'default' } })
      await new Promise((resolve) => server.close(resolve))
    }
  }
}

export function personalLinkToken(email: ReceivedEmail) {
  return email.text.match(/\/inscription\/([\w-]+)/)?.[1]
}
