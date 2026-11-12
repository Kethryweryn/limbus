// Pages légales (US-110, US-111, SPEC-013, ADR-0055) : ce qui revient d'une page à l'autre

/** Version des conditions d'utilisation et de la politique de confidentialité : la changer fait accepter de nouveau. */
export const TERMS_VERSION = '2026-11-10'
export const TERMS_VERSION_LABEL = '10 novembre 2026'

export const LEGAL_EDITOR = {
  name: 'Jean-Damien Mottot',
  status: 'particulier',
  email: 'limbus@limbuslarp.fr',
  site: 'https://limbuslarp.fr'
}

export const LEGAL_HOST = {
  name: 'Scaleway SAS',
  description: 'société par actions simplifiée, RCS Paris 433 115 904',
  address: '8, rue de la Ville-l’Évêque, 75008 Paris, France',
  site: 'https://www.scaleway.com'
}

// Durées de conservation annoncées (SPEC-013 L6) : la politique de confidentialité les reprend telles quelles
export const RETENTION = {
  inactiveAccountMonths: 24,
  inactiveAccountWarningMonths: 23,
  participantWithoutAccountYears: 3,
  unconfirmedAccountDays: 7,
  unconfirmedFormDays: 7,
  // Autre adresse donnée en réponse, à prouver par un lien (US-243, ADR-0087)
  addressProofDays: 7,
  contactEmailYears: 3,
  // Assistants d'IA (SPEC-014) : autorisation finie après 90 jours sans usage, journal gardé un an
  aiAuthorizationIdleDays: 90,
  aiLogDays: 365
}

export const LEGAL_PAGES = [
  { to: '/mentions-legales', label: 'Mentions légales' },
  { to: '/confidentialite', label: 'Confidentialité' },
  { to: '/conditions', label: 'Conditions d’utilisation' }
]
