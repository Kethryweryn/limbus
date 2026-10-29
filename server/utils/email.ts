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

// Délais bornés : un serveur SMTP qui ne répond pas ne doit pas bloquer une requête indéfiniment
const SMTP_TIMEOUTS = { connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 30_000 }

export type EmailTransport = {
  send: (message: EmailMessage) => Promise<{ sent: true, messageId: string }>
  close: () => void
}

/**
 * Connexion SMTP réutilisable pour un envoi groupé (une seule connexion pour N emails).
 * null si l'envoi d'emails est désactivé. Penser à appeler close().
 */
export async function openEmailTransport(): Promise<EmailTransport | null> {
  const settings = await getSmtpSettings()
  if (!settings?.enabled) return null

  if (!settings.host || !settings.fromEmail) {
    throw createError({ statusCode: 500, message: 'Configuration SMTP incomplète' })
  }

  const nodemailer = await import('nodemailer')
  const password = settings.passwordEncrypted ? decryptSmtpPassword(settings.passwordEncrypted) : undefined
  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    pool: true,
    maxConnections: 1,
    ...SMTP_TIMEOUTS,
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

  return {
    async send(message: EmailMessage) {
      try {
        const info = await transporter.sendMail({
          from,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
          attachments: message.attachments
        })
        return { sent: true as const, messageId: info.messageId }
      } catch (error: any) {
        // Trace côté serveur (journalctl -u limbus) : sans elle, la cause n'apparaît que dans le navigateur.
        // Pas de destinataire ni de contenu : ce sont des données personnelles.
        console.error(`[smtp] échec d'envoi via ${settings.host}:${settings.port}`, {
          code: error?.code,
          responseCode: error?.responseCode,
          command: error?.command,
          response: error?.response || error?.message
        })
        throw createError({
          statusCode: 502,
          message: smtpErrorMessage(error)
        })
      }
    },
    close() {
      transporter.close?.()
    }
  }
}

export async function sendEmail(message: EmailMessage) {
  const transport = await openEmailTransport()
  if (!transport) {
    return { sent: false, reason: 'smtp_disabled' }
  }
  try {
    return await transport.send(message)
  } finally {
    transport.close()
  }
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

// Legs d'une copie à une organisatrice qui a déjà un compte (SPEC-002 R7)
export function gameBequestEmailText(params: { gameTitle: string, ownerName: string, url: string }) {
  return [
    `${params.ownerName} vous lègue une copie de son jeu « ${params.gameTitle} » dans Limbus.`,
    '',
    'Cette copie vous appartient : vous pouvez la modifier librement et organiser vos propres sessions. Le jeu d’origine n’est pas touché.',
    '',
    `Ouvrir la copie : ${params.url}`
  ].join('\n')
}

export async function sendGameBequestEmail(params: { to: string, gameTitle: string, ownerName: string, url: string }) {
  return await sendEmail({
    to: params.to,
    subject: `Un jeu vous est légué : ${params.gameTitle}`,
    text: gameBequestEmailText(params),
    html: `
      <p>${escapeHtml(params.ownerName)} vous lègue une copie de son jeu <strong>${escapeHtml(params.gameTitle)}</strong> dans Limbus.</p>
      <p>Cette copie vous appartient : vous pouvez la modifier librement et organiser vos propres sessions. Le jeu d’origine n’est pas touché.</p>
      <p><a href="${escapeHtml(params.url)}">Ouvrir la copie</a></p>
    `
  })
}

// Legs à une personne sans compte (SPEC-002 R8) : le lien crée le compte et attribue la copie
export function gameBequestInvitationEmailText(params: { gameTitle: string, ownerName: string, url: string, expiresAt: Date }) {
  const expires = params.expiresAt.toLocaleDateString('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' })
  return [
    `${params.ownerName} vous lègue une copie de son jeu « ${params.gameTitle} » dans Limbus, l’outil d’organisation de GN.`,
    '',
    'Pour la recevoir, créez votre compte avec ce lien (ou connectez-vous si vous en avez déjà un) : la copie vous appartiendra aussitôt, et vous pourrez la modifier librement.',
    params.url,
    '',
    `Ce lien est valable jusqu’au ${expires}. Passé cette date, la copie est supprimée.`
  ].join('\n')
}

export async function sendGameBequestInvitationEmail(params: { to: string, gameTitle: string, ownerName: string, url: string, expiresAt: Date }) {
  const text = gameBequestInvitationEmailText(params)
  return await sendEmail({
    to: params.to,
    subject: `Un jeu vous est légué : ${params.gameTitle}`,
    text,
    html: text.split('\n')
      .filter(Boolean)
      .map((line) => (line === params.url
        ? `<p><a href="${escapeHtml(params.url)}">Créer mon compte et recevoir la copie</a></p>`
        : `<p>${escapeHtml(line)}</p>`))
      .join('\n')
  })
}

// Emails du compte (EPIC-013) : un paragraphe, un lien, une précision éventuelle
async function sendAccountEmail(params: { to: string, subject: string, intro: string, linkLabel?: string, url?: string, outro?: string }) {
  const link = params.url && params.linkLabel ? params.url : null
  return await sendEmail({
    to: params.to,
    subject: params.subject,
    text: [params.intro, ...(link ? ['', `${params.linkLabel} : ${link}`] : []), ...(params.outro ? ['', params.outro] : [])].join('\n'),
    html: [
      `<p>${escapeHtml(params.intro)}</p>`,
      link ? `<p><a href="${escapeHtml(link)}">${escapeHtml(params.linkLabel!)}</a></p>` : '',
      params.outro ? `<p>${escapeHtml(params.outro)}</p>` : ''
    ].join('\n')
  })
}

export async function sendAccountConfirmationEmail(params: { to: string, url: string }) {
  return await sendAccountEmail({
    to: params.to,
    subject: 'Confirmez votre adresse pour Limbus',
    intro: 'Bienvenue sur Limbus ! Confirmez votre adresse pour activer votre compte.',
    linkLabel: 'Confirmer mon adresse',
    url: params.url,
    outro: 'Le lien est valable 48 heures. Si vous n’avez pas créé de compte, ignorez ce message : sans confirmation, il sera supprimé dans 7 jours.'
  })
}

// Inscription avec une adresse déjà prise : on ne le révèle pas à l'écran, mais la personne est prévenue (US-061)
export async function sendAccountExistsEmail(params: { to: string, url: string }) {
  return await sendAccountEmail({
    to: params.to,
    subject: 'Vous avez déjà un compte Limbus',
    intro: 'Quelqu’un (sans doute vous) a voulu créer un compte Limbus avec cette adresse, qui en a déjà un. Connectez-vous, ou choisissez un nouveau mot de passe si vous l’avez oublié.',
    linkLabel: 'Mot de passe oublié',
    url: params.url,
    outro: 'Si ce n’était pas vous, ignorez ce message : votre compte n’a pas changé.'
  })
}

export async function sendPasswordLinkEmail(params: { to: string, url: string, created: boolean, validity: string }) {
  return await sendAccountEmail({
    to: params.to,
    subject: params.created ? 'Votre compte Limbus' : 'Choisir un nouveau mot de passe Limbus',
    intro: params.created
      ? 'Un compte Limbus vient d’être créé pour vous. Choisissez votre mot de passe pour vous connecter.'
      : 'Vous avez demandé à choisir un nouveau mot de passe pour Limbus.',
    linkLabel: 'Choisir mon mot de passe',
    url: params.url,
    outro: `Le lien est valable ${params.validity} et ne sert qu’une fois.${params.created ? '' : ' Si vous n’avez rien demandé, ignorez ce message.'}`
  })
}

export async function sendEmailChangeConfirmationEmail(params: { to: string, url: string }) {
  return await sendAccountEmail({
    to: params.to,
    subject: 'Confirmez votre nouvelle adresse pour Limbus',
    intro: 'Vous avez demandé à utiliser cette adresse pour votre compte Limbus.',
    linkLabel: 'Confirmer cette adresse',
    url: params.url,
    outro: 'Le lien est valable 48 heures. Tant qu’il n’est pas utilisé, votre compte garde son ancienne adresse.'
  })
}

export async function sendEmailChangedNoticeEmail(params: { to: string, newEmail: string }) {
  return await sendAccountEmail({
    to: params.to,
    subject: 'L’adresse de votre compte Limbus a changé',
    intro: `L’adresse de votre compte Limbus est désormais ${params.newEmail}. Ce message part à votre ancienne adresse.`,
    outro: 'Si vous n’êtes pas à l’origine de ce changement, prévenez l’administratrice de Limbus.'
  })
}

// Transfert d'un jeu proposé à une co-organisatrice (US-068)
export async function sendGameTransferEmail(params: { to: string, gameTitle: string, ownerName: string, url: string }) {
  return await sendAccountEmail({
    to: params.to,
    subject: `${params.ownerName} vous propose le jeu ${params.gameTitle}`,
    intro: `${params.ownerName} vous propose de devenir propriétaire du jeu « ${params.gameTitle} » dans Limbus. Elle en resterait co-organisatrice.`,
    linkLabel: 'Accepter ou refuser',
    url: params.url
  })
}
