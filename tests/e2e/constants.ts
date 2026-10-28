export const E2E_PASSWORD = 'mot-de-passe-e2e'

// Un compte par scénario qui change l'état de session (déconnexion partout…) pour garder les tests indépendants
export const E2E_USERS = {
  orga: 'orga@example.test',
  partout: 'partout@example.test',
  autre: 'autre@example.test',
  // Destinataire d'un legs (US-010)
  heritiere: 'heritiere@example.test'
} as const
