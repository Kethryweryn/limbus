import { inSentence } from './sessionLabels'
import { PARIS_TIME_ZONE, formatLongDateTime } from '~/utils/dates'

// Email d'annulation proposé à l'équipe d'une session (US-025) : texte par défaut, modifiable avant l'envoi

const formatDateTime = (value: Date | string) => formatLongDateTime(value, PARIS_TIME_ZONE)

export function cancellationEmailDefaults(params: { gameTitle: string, sessionLabel: string, sessionDate: Date | string | null }) {
  return {
    subject: `Session annulée : ${params.gameTitle}`,
    text: [
      'Bonjour,',
      '',
      `Nous sommes au regret de vous annoncer que la ${inSentence(params.sessionLabel)} de « ${params.gameTitle} »${params.sessionDate ? `, prévue le ${formatDateTime(params.sessionDate)},` : ''} est annulée.`,
      '',
      'Nous reviendrons vers vous pour le remboursement des sommes déjà versées, ou pour une nouvelle date.',
      '',
      'L’équipe d’organisation'
    ].join('\n')
  }
}
