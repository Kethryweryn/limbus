// Les Cendres de Valombre, jeu de test « session imminente » : casting, paiements, présence, envois et déroulé
// (US-153, ADR-0066)
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { characterSheetContentHash, documentContentHash } from '../../server/utils/deliveryHashes'
import { renderTextPdf, type TextPdfInput } from '../../server/utils/generatedPdfs'
import { uploadDir, UPLOAD_DIRS } from '../../server/utils/uploads'
import { SESSION_ROLES, SESSION_STATUSES } from '../../utils/domain'
import { RIB_UPLOAD_PREFIX } from '../../utils/urls'
import type { Db, StageContext } from './db'
import { daysFromNow, sessionDate, sessionFields } from './options'
import type { AttendanceStatus, TariffRole } from '../../generated/prisma/enums'

// Délai laissé aux réponses de présence, en jours
const ATTENDANCE_DUE_IN_DAYS = 5

// Ce qui part à une personne, tel qu'un envoi le garde (ADR-0044)
async function textCopyData(input: TextPdfInput) {
  const pdf = await renderTextPdf(input)
  const content = { kind: 'text' as const, ...input }
  return {
    copyPdf: Buffer.from(pdf),
    copyContent: content,
    copySize: pdf.byteLength + Buffer.byteLength(JSON.stringify(content))
  }
}

export async function createValombreStage(db: Db, context: StageContext) {
  const { gameId, title, locationId, characters, people, photos } = context
  const person = (email: string) => people.get(`${email}@example.test`)!
  const camille = person('camille.bernard')
  const lucie = person('lucie.moreau')
  const nicolas = person('nicolas.martin')
  const sarah = person('sarah.petit')
  const julien = person('julien.robert')
  const antoine = person('antoine.durand')
  const kitchen = person('elise.leroy')
  const organizer = person('thomas.garnier')
  const ines = person('ines.lefevre')
  const character = (name: string) => characters.find((row) => row.name === name)!

  await db.game.update({ where: { id: gameId }, data: { aiForCoorganizers: true } })

  // Notes de l'équipe, propres à ce jeu (ADR-0040)
  await db.participantGame.update({
    where: { participantId_gameId: { participantId: camille.id, gameId } },
    data: { notes: 'Arrive tard le vendredi. À prévenir pour le covoiturage.' }
  })

  // La session approche et n'attend plus qu'un rôle : Bastian Lorme reste à distribuer
  const roles: Array<[string, { id: string } | null, string?]> = [
    ['Aélis de Valombre', camille, 'Brief à vérifier avant impression.'],
    ['Marceau Trelane', lucie],
    ['Sœur Ysilde', nicolas],
    ['Corvin le Noir', sarah],
    ['Nora Fiel', julien],
    ['Bastian Lorme', null],
    ['Hélène de Briseciel', organizer],
    ['Toma le Rouge', ines]
  ]
  const ribFilename = 'seed-rib-valombre.pdf'
  const ribUrl = `${RIB_UPLOAD_PREFIX}${ribFilename}`
  const session = await db.session.create({
    data: {
      // Session imminente (SPEC-021 : date, libellé et adresse calculés)
      ...sessionFields(title, 10),
      gameId,
      locationId,
      status: SESSION_STATUSES.scheduled,
      published: true,
      withdrawalDeadline: sessionDate(3),
      paymentRibUrl: ribUrl,
      paymentLinkUrl: 'https://paiement.example.test/valombre',
      paymentSettingsUpdatedAt: daysFromNow(-30),
      assignments: {
        create: roles.map(([name, holder, notes]) => ({
          characterId: character(name).id,
          notes,
          participantId: holder?.id ?? null,
          photoUrl: holder ? photos.get(holder.id) ?? null : null
        }))
      },
      participants: {
        create: [
          ...[camille, lucie, nicolas, sarah, julien].map(({ id }) => ({ participantId: id, role: SESSION_ROLES.participant })),
          { participantId: organizer.id, role: SESSION_ROLES.organizer },
          { participantId: ines.id, role: SESSION_ROLES.npc },
          { participantId: kitchen.id, role: SESSION_ROLES.kitchen }
        ]
      }
    },
    select: { id: true, name: true }
  })

  // Une session plus lointaine, au casting encore ouvert
  await db.session.create({
    data: {
      // Session d'automne (SPEC-021 : date, libellé et adresse calculés)
      ...sessionFields(title, 75),
      gameId,
      locationId,
      status: SESSION_STATUSES.scheduled,
      published: true,
      assignments: {
        create: roles.map(([name], index) => ({
          characterId: character(name).id,
          participantId: index < 2 ? [lucie, nicolas][index]!.id : null
        }))
      },
      participants: { create: [lucie, nicolas].map(({ id }) => ({ participantId: id, role: SESSION_ROLES.participant })) }
    }
  })

  // RIB fictif, servi par la même route qu'un vrai
  const ribPdf = await renderTextPdf({ title: 'RIB fictif', subtitle: 'Jeu d’essai : ne pas utiliser', sections: [{ body: 'Ce document sert à essayer l’envoi des informations de paiement.' }] })
  const ribDir = uploadDir(UPLOAD_DIRS.ribs)
  await mkdir(ribDir, { recursive: true })
  await writeFile(join(ribDir, ribFilename), ribPdf, { mode: 0o644 })
  await db.uploadedFile.create({
    data: { kind: 'sessionPaymentRib', filename: ribFilename, url: ribUrl, size: ribPdf.byteLength, gameId, sessionId: session.id }
  })

  const tariff = (name: string, amountCents: number, defaultRole?: TariffRole, baseTariffId?: string) => db.sessionTariff.create({
    data: { sessionId: session.id, name, amountCents, defaultRole, baseTariffId },
    select: { id: true }
  })
  const playerTariff = await tariff('Personnage joueur', 12000, 'pj')
  await tariff('Personnage non joueur', 4000, 'pnj')
  await tariff('Organisation', 0, 'organizer')
  await tariff('Cuisine', 2000, 'kitchen')
  const supportTariff = await tariff('Tarif de soutien', 15000, undefined, playerTariff.id)
  const reducedTariff = await tariff('Tarif réduit', 9000, undefined, playerTariff.id)

  const payment = (participantId: string, data: {
    tariffId?: string
    paidAt?: Date
    offered?: boolean
    paymentEmailSentAt?: Date
    paymentReminderSentAt?: Date
    transferredToParticipantId?: string
    instalments?: Array<[number, number]>
  }) => db.sessionPayment.create({
    data: {
      gameId,
      sessionId: session.id,
      participantId,
      tariffId: data.tariffId,
      paidAt: data.paidAt,
      offered: data.offered,
      paymentEmailSentAt: data.paymentEmailSentAt ?? daysFromNow(-20),
      paymentReminderSentAt: data.paymentReminderSentAt,
      transferredToParticipantId: data.transferredToParticipantId,
      instalments: data.instalments
        ? { create: data.instalments.map(([amountCents, days]) => ({ amountCents, receivedAt: daysFromNow(days) })) }
        : undefined
    }
  })
  await payment(camille.id, { tariffId: supportTariff.id, paidAt: daysFromNow(-12) })
  await payment(lucie.id, { instalments: [[4000, -15], [4000, -5]] })
  await payment(nicolas.id, { tariffId: reducedTariff.id, paymentReminderSentAt: daysFromNow(-5) })
  await payment(sarah.id, { offered: true })
  // Antoine est parti : son paiement revient à Julien, qui a repris sa place
  await payment(antoine.id, { paidAt: daysFromNow(-30), transferredToParticipantId: julien.id })
  await payment(kitchen.id, { paidAt: daysFromNow(-8) })

  // La session imminente remplace une session reportée : seule une session reportée demande une présence (US-024)
  await db.session.create({
    data: {
      // Session reportée (SPEC-021 : date, libellé et adresse calculés)
      ...sessionFields(title, -20),
      gameId,
      locationId,
      status: SESSION_STATUSES.postponed,
      published: true,
      postponedToSessionId: session.id
    }
  })

  // Demandes déjà parties. Nicolas et Inès n'en ont pas : l'équipe les lance depuis l'application, ce qui crée leur lien.
  const attendance = (participantId: string, status: AttendanceStatus, dueInDays: number, respondedDaysAgo?: number) => ({
    sessionId: session.id,
    participantId,
    status,
    responseDueAt: daysFromNow(dueInDays),
    invitationSentAt: daysFromNow(-6),
    respondedAt: respondedDaysAgo === undefined ? null : daysFromNow(-respondedDaysAgo)
  })
  await db.sessionAttendance.createMany({
    data: [
      attendance(camille.id, 'pending', ATTENDANCE_DUE_IN_DAYS),
      attendance(lucie.id, 'confirmed', ATTENDANCE_DUE_IN_DAYS, 2),
      attendance(sarah.id, 'declined', ATTENDANCE_DUE_IN_DAYS, 1),
      attendance(organizer.id, 'confirmed', ATTENDANCE_DUE_IN_DAYS, 3),
      attendance(kitchen.id, 'confirmed', ATTENDANCE_DUE_IN_DAYS, 3),
      // Délai dépassé : c'est à la lecture que l'application le signale
      attendance(julien.id, 'pending', -1)
    ]
  })

  // Envois déjà faits : l'un à jour, l'autre dépassé parce que le document a changé depuis
  const documents = await db.document.findMany({ where: { gameId, audiences: { has: 'pjs' } }, select: { id: true, title: true, content: true, documentUrl: true } })
  const roadmap = documents.find((row) => row.title.startsWith('Feuille de route'))!
  const world = documents.find((row) => row.title.startsWith('Document monde'))!
  const sessionForHash = { name: session.name, game: { title } }
  const worldBefore = { title: world.title, subtitle: session.name, sections: [{ body: 'Version envoyée avant la dernière correction de l’équipe.' }] }
  for (const recipient of [camille, lucie, nicolas]) {
    await db.sessionDocumentDelivery.create({
      data: {
        gameId,
        sessionId: session.id,
        participantId: recipient.id,
        documentId: roadmap.id,
        kind: 'document',
        contentHash: documentContentHash(sessionForHash, roadmap),
        sentAt: daysFromNow(-4),
        ...(await textCopyData({ title: roadmap.title, subtitle: session.name, sections: [{ body: roadmap.content }] }))
      }
    })
    await db.sessionDocumentDelivery.create({
      data: {
        gameId,
        sessionId: session.id,
        participantId: recipient.id,
        documentId: world.id,
        kind: 'document',
        contentHash: documentContentHash(sessionForHash, { ...world, content: worldBefore.sections[0]!.body }),
        sentAt: daysFromNow(-4),
        ...(await textCopyData(worldBefore))
      }
    })
  }

  const aelis = await db.character.findUniqueOrThrow({
    where: { id: character('Aélis de Valombre').id },
    select: { id: true, name: true, pitch: true, background: true, backgroundDocumentUrl: true, costumeIndications: true }
  })
  await db.sessionDocumentDelivery.create({
    data: {
      gameId,
      sessionId: session.id,
      participantId: camille.id,
      characterId: aelis.id,
      kind: 'character_sheet',
      contentHash: characterSheetContentHash({ name: session.name }, aelis),
      sentAt: daysFromNow(-4),
      ...(await textCopyData({ title: aelis.name, subtitle: session.name, sections: [{ title: 'Présentation', body: aelis.pitch }, { title: 'Histoire', body: aelis.background }] }))
    }
  })

  // Sans empreinte, l'application le signale à regénérer, ce qui montre aussi la vraie génération du PDF
  const cards = roles.flatMap(([name, holder]) => holder && name !== aelis.name && character(name).type === 'pj'
    ? [{ displayName: name, tags: [], note: '', photoUrl: photos.get(holder.id) ?? null }]
    : [])
  await db.sessionTrombinoscope.create({
    data: {
      gameId,
      sessionId: session.id,
      viewerCharacterId: aelis.id,
      participantId: camille.id,
      fileName: 'trombinoscope-aelis.pdf',
      contentPdf: Buffer.from(await renderTextPdf({ title: `Trombinoscope de ${aelis.name}`, subtitle: session.name, sections: cards.map((card) => ({ title: card.displayName })) })),
      contentHtml: `<h1>Trombinoscope de ${aelis.name}</h1>`,
      contentJson: cards
    }
  })
  await db.sessionDocumentDelivery.create({
    data: { gameId, sessionId: session.id, participantId: camille.id, characterId: aelis.id, kind: 'trombinoscope', sentAt: daysFromNow(-4) }
  })

  // Déroulé : responsables complets, manquants, et Thomas à deux endroits à 14 h 30
  const events = await db.timelineEvent.findMany({ where: { gameId }, select: { id: true, name: true } })
  const event = (name: string) => events.find((row) => row.name === name)!.id
  const responsible = (name: string, participantId: string) => ({ gameId, sessionId: session.id, timelineEventId: event(name), participantId })
  await db.timelineEventResponsible.createMany({
    data: [
      responsible('Briefing d’ouverture', organizer.id),
      responsible('Briefing d’ouverture', ines.id),
      responsible('Intervention secrète', organizer.id),
      responsible('Incident concurrent', organizer.id),
      responsible('Débriefing de fin de journée', ines.id)
    ]
  })
}
