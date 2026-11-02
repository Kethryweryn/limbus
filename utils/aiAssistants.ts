// Assistants d'IA (SPEC-014) : ce que le serveur et l'interface partagent

/** Actions notées au journal des assistants (R13). */
export const AI_LOG_ACTIONS = {
  authorized: 'autorisation',
  updated: 'modification',
  revoked: 'retrait',
  expired: 'expiration',
  sessionsRevoked: 'déconnexion',
  reused: 'réutilisation',
  tool: 'outil'
} as const

export const AI_LOG_ACTION_LABELS: Record<string, string> = {
  [AI_LOG_ACTIONS.authorized]: 'autorisé',
  [AI_LOG_ACTIONS.updated]: 'jeux changés',
  [AI_LOG_ACTIONS.revoked]: 'retiré',
  [AI_LOG_ACTIONS.expired]: 'expiré après 90 jours sans usage',
  [AI_LOG_ACTIONS.sessionsRevoked]: 'coupé (déconnexion partout ou compte désactivé)',
  [AI_LOG_ACTIONS.reused]: 'retiré (jeton réutilisé)',
  [AI_LOG_ACTIONS.tool]: 'action'
}
