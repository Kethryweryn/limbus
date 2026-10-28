import { prisma } from '~/server/utils/prisma'
import { openEmailTransport } from '~/server/utils/email'
import { generatedPdfFileName, renderTextPdf } from '~/server/utils/generatedPdfs'
import { REGISTRATION_STATUSES, SESSION_ROLES } from '~/utils/domain'

type AllergySheetSource = {
  name: string
  date: Date | null
  game: { title: string }
  registrations: Array<{ dietary: string | null, participant: { name: string } }>
}

/**
 * Fiche allergies d'une session (US-008, R15) : nom et allergies de chaque personne confirmée
 * qui en a déclaré, et le nombre de personnes confirmées. Jamais de téléphone ni de contact
 * d'urgence. Construite à la demande et jamais stockée, pour ne pas multiplier les copies de
 * données de santé : une personne désistée en disparaît aussitôt.
 */
export function buildAllergySheet(session: AllergySheetSource) {
  const people = session.registrations
    .filter((registration) => registration.dietary?.trim())
    .map((registration) => ({ name: registration.participant.name, dietary: registration.dietary!.trim() }))
    .sort((left, right) => left.name.localeCompare(right.name, 'fr'))
  return {
    session: { name: session.name, date: session.date, gameTitle: session.game.title },
    confirmedCount: session.registrations.length,
    people
  }
}

export type AllergySheet = ReturnType<typeof buildAllergySheet>

// Pour l'écran : la fiche et sa phrase de synthèse, la même que dans le PDF et l'email
export async function getAllergySheetForDisplay(sessionId: string) {
  const sheet = await getAllergySheet(sessionId)
  return { ...sheet, summary: allergySheetSummary(sheet) }
}

export async function getAllergySheet(sessionId: string) {
  const session = await prisma.session.findUniqueOrThrow({
    where: { id: sessionId },
    select: {
      name: true,
      date: true,
      game: { select: { title: true } },
      registrations: {
        where: { status: REGISTRATION_STATUSES.confirmed },
        select: { dietary: true, participant: { select: { name: true } } }
      }
    }
  })
  return buildAllergySheet(session)
}

const formatDate = (value: Date) => value.toLocaleDateString('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' })

const plural = (count: number) => (count > 1 ? 's' : '')

export function allergySheetSummary(sheet: AllergySheet) {
  const confirmed = sheet.confirmedCount
  const declared = sheet.people.length
  return `${confirmed} personne${plural(confirmed)} confirmée${plural(confirmed)}, dont ${declared} personne${plural(declared)} avec allergies ou intolérances`
}

export async function renderAllergySheetPdf(sheet: AllergySheet) {
  const subtitle = [
    sheet.session.gameTitle,
    sheet.session.date ? formatDate(sheet.session.date) : null,
    allergySheetSummary(sheet)
  ].filter(Boolean).join(' · ')
  const bytes = await renderTextPdf({
    title: `Fiche allergies – ${sheet.session.name}`,
    subtitle,
    sections: sheet.people.length
      // Une ligne déclarée par paragraphe : le rendu PDF regroupe les retours à la ligne simples
      ? sheet.people.map((person) => ({ title: person.name, body: person.dietary.replace(/\n+/g, '\n\n') }))
      : [{ body: 'Aucune allergie ni intolérance déclarée.' }]
  })
  return { bytes, filename: generatedPdfFileName(['allergies', sheet.session.name]) }
}

export function allergySheetEmailText(sheet: AllergySheet) {
  return [
    'Bonjour,',
    '',
    `Voici la fiche allergies de la session ${sheet.session.name} (« ${sheet.session.gameTitle} ») : ${allergySheetSummary(sheet)}.`,
    '',
    'Ce sont des données de santé : merci de ne pas la diffuser au-delà de l’équipe cuisine et de la supprimer après le jeu.'
  ].join('\n')
}

/**
 * Envoie la fiche en pièce jointe à chaque membre de l'équipe cuisine de la session qui a un email,
 * un email par personne. Le verrou d'envoi de session est pris par la route.
 */
export async function sendAllergySheet(sessionId: string) {
  const kitchen = await prisma.sessionParticipant.findMany({
    where: { sessionId, role: SESSION_ROLES.kitchen },
    select: { participant: { select: { name: true, email: true } } }
  })
  const recipients = [...new Set(kitchen.map((member) => member.participant.email?.trim()).filter((email): email is string => Boolean(email)))]
  if (!kitchen.length) {
    throw createError({ statusCode: 400, message: 'La session n’a pas d’équipe cuisine : ajoutez ses membres avec le rôle « Cuisine » dans le cast.' })
  }
  if (!recipients.length) {
    throw createError({ statusCode: 400, message: 'Aucun membre de l’équipe cuisine de la session n’a d’adresse email.' })
  }

  const sheet = await getAllergySheet(sessionId)
  const pdf = await renderAllergySheetPdf(sheet)
  const transport = await openEmailTransport()
  if (!transport) {
    throw createError({ statusCode: 500, message: 'SMTP désactivé' })
  }

  const failures: string[] = []
  try {
    for (const to of recipients) {
      try {
        await transport.send({
          to,
          subject: `Fiche allergies – ${sheet.session.name}`,
          text: allergySheetEmailText(sheet),
          attachments: [{ filename: pdf.filename, content: Buffer.from(pdf.bytes), contentType: 'application/pdf' }]
        })
      } catch {
        failures.push(to)
      }
    }
  } finally {
    transport.close()
  }

  return { sentCount: recipients.length - failures.length, failures }
}
