export const E2E_PASSWORD = 'mot-de-passe-e2e'

// Un compte par scénario qui change l'état de session (déconnexion partout…) pour garder les tests indépendants
export const E2E_USERS = {
  orga: 'orga@example.test',
  partout: 'partout@example.test',
  autre: 'autre@example.test',
  // Destinataire d'un legs (US-010)
  heritiere: 'heritiere@example.test'
} as const

// Jeu commun des tests des parcours (ADR-0037)
export const PARCOURS = {
  game: 'Jeu des parcours',
  gameSlug: 'jeu-des-parcours',
  characters: [
    { name: 'Aube', slug: 'aube-parcours', type: 'pj' },
    { name: 'Brume', slug: 'brume-parcours', type: 'pj' },
    { name: 'Garde', slug: 'garde-parcours', type: 'pnj' }
  ],
  participants: [
    { name: 'Léa Parcours', slug: 'lea-parcours', email: 'lea.parcours@example.test' },
    { name: 'Noé Parcours', slug: 'noe-parcours', email: 'noe.parcours@example.test' },
    { name: 'Sam Parcours', slug: 'sam-parcours', email: 'sam.parcours@example.test' }
  ]
} as const
