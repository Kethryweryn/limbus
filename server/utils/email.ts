import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { prisma } from '~/server/utils/prisma'

type EmailAttachment = {
  filename: string
  content: Buffer | string
  contentType?: string
}

type EmailMessage = {
  to: string | string[]
  subject: string
  text?: string
  html?: string
  attachments?: EmailAttachment[]
}

const SMTP_SETTINGS_ID = 'default'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getEncryptionKey() {
  const config = useRuntimeConfig()
  const secret = config.smtpEncryptionSecret || config.jwtSecret || process.env.SMTP_ENCRYPTION_SECRET || process.env.JWT_SECRET
  if (!secret) {
    throw createError({
      statusCode: 500,
      message: 'SMTP_ENCRYPTION_SECRET ou JWT_SECRET doit être configuré pour chiffrer le mot de passe SMTP'
    })
  }

  return createHash('sha256').update(secret).digest()
}

export function encryptSmtpPassword(password: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [iv, tag, encrypted].map((part) => part.toString('base64url')).join(':')
}

export function decryptSmtpPassword(payload: string) {
  const [ivRaw, tagRaw, encryptedRaw] = payload.split(':')
  if (!ivRaw || !tagRaw || !encryptedRaw) {
    throw createError({ statusCode: 500, message: 'Mot de passe SMTP invalide' })
  }

  try {
    const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivRaw, 'base64url'))
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'))

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedRaw, 'base64url')),
      decipher.final()
    ]).toString('utf8')
  } catch {
    throw createError({
      statusCode: 500,
      message: 'Impossible de déchiffrer le mot de passe SMTP. Vérifiez SMTP_ENCRYPTION_SECRET/JWT_SECRET ou ressaisissez le mot de passe SMTP.'
    })
  }
}

function smtpErrorMessage(error: any) {
  const code = String(error?.code || '')
  const command = String(error?.command || '')
  const response = String(error?.response || error?.message || '')
  const statusCode = Number(error?.responseCode || 0)

  if (code === 'EAUTH' || command === 'AUTH' || statusCode === 535 || statusCode === 534) {
    return 'Authentification SMTP refusée. Vérifiez le login SMTP et le mot de passe ou la clé SMTP.'
  }

  if (code === 'ECONNECTION' || code === 'ESOCKET' || code === 'ETIMEDOUT') {
    return 'Connexion au serveur SMTP impossible. Vérifiez le serveur, le port, la sécurité TLS et les restrictions IP.'
  }

  if (statusCode >= 500 && statusCode < 600) {
    return `Le serveur SMTP a refusé l’envoi : ${response || `erreur ${statusCode}`}`
  }

  if (response) {
    return `Erreur SMTP : ${response}`
  }

  return 'Erreur SMTP inconnue pendant l’envoi.'
}

export async function getSmtpSettings() {
  return await prisma.smtpSettings.findUnique({
    where: { id: SMTP_SETTINGS_ID }
  })
}

export function serializeSmtpSettings(settings: Awaited<ReturnType<typeof getSmtpSettings>>) {
  if (!settings) return null

  return {
    id: settings.id,
    enabled: settings.enabled,
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    username: settings.username,
    hasPassword: Boolean(settings.passwordEncrypted),
    fromEmail: settings.fromEmail,
    fromName: settings.fromName,
    createdAt: settings.createdAt,
    updatedAt: settings.updatedAt
  }
}

export async function upsertSmtpSettings(data: {
  enabled: boolean
  host: string
  port: number
  secure: boolean
  username?: string | null
  password?: string | null
  fromEmail: string
  fromName?: string | null
}) {
  const existing = await getSmtpSettings()
  const passwordEncrypted = data.password?.trim()
    ? encryptSmtpPassword(data.password.trim())
    : data.password === null
      ? null
      : existing?.passwordEncrypted

  return await prisma.smtpSettings.upsert({
    where: { id: SMTP_SETTINGS_ID },
    create: {
      id: SMTP_SETTINGS_ID,
      enabled: data.enabled,
      host: data.host,
      port: data.port,
      secure: data.secure,
      username: data.username || null,
      passwordEncrypted,
      fromEmail: data.fromEmail,
      fromName: data.fromName || null
    },
    update: {
      enabled: data.enabled,
      host: data.host,
      port: data.port,
      secure: data.secure,
      username: data.username || null,
      passwordEncrypted,
      fromEmail: data.fromEmail,
      fromName: data.fromName || null
    }
  })
}

export async function sendEmail(message: EmailMessage) {
  const settings = await getSmtpSettings()
  if (!settings?.enabled) {
    return { sent: false, reason: 'smtp_disabled' }
  }

  if (!settings.host || !settings.fromEmail) {
    throw createError({ statusCode: 500, message: 'Configuration SMTP incomplète' })
  }

  const nodemailer = await import('nodemailer')
  const password = settings.passwordEncrypted ? decryptSmtpPassword(settings.passwordEncrypted) : undefined
  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: settings.username
      ? {
          user: settings.username,
          pass: password || ''
        }
      : undefined
  })

  const from = settings.fromName
    ? `"${settings.fromName.replace(/"/g, '\\"')}" <${settings.fromEmail}>`
    : settings.fromEmail

  let info
  try {
    info = await transporter.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      attachments: message.attachments
    })
  } catch (error: any) {
    throw createError({
      statusCode: 502,
      message: smtpErrorMessage(error)
    })
  }

  return { sent: true, messageId: info.messageId }
}

export async function sendGameInvitationEmail(params: {
  to: string
  gameTitle: string
  inviterName: string
  url: string
}) {
  const gameTitle = escapeHtml(params.gameTitle)
  const inviterName = escapeHtml(params.inviterName)
  const url = escapeHtml(params.url)

  return await sendEmail({
    to: params.to,
    subject: `Invitation à collaborer sur ${params.gameTitle}`,
    text: [
      `${params.inviterName} vous invite à collaborer sur le jeu "${params.gameTitle}" dans Limbus.`,
      '',
      `Accepter l'invitation : ${params.url}`
    ].join('\n'),
    html: `
      <p>${inviterName} vous invite à collaborer sur le jeu <strong>${gameTitle}</strong> dans Limbus.</p>
      <p><a href="${url}">Accepter l'invitation</a></p>
    `
  })
}
