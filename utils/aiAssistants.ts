// Assistants d'IA (SPEC-014) : ce que le serveur et l'interface partagent

/** Actions notées au journal des assistants (R13). */
export const AI_LOG_ACTIONS = {
  authorized: 'autorisation',
  updated: 'modification',
  revoked: 'retrait',
  expired: 'expiration',
  sessionsRevoked: 'déconnexion',
  reused: 'réutilisation',
  // Écritures d'un assistant (SPEC-014, R13)
  created: 'création',
  changed: 'mise à jour',
  deleted: 'suppression'
} as const

/** Sortes d'éléments qu'un assistant écrit, avec leur nom au journal. */
export const AI_TARGET_LABELS: Record<string, string> = {
  game: 'jeu',
  character: 'personnage',
  faction: 'faction',
  intrigue: 'intrigue',
  item: 'objet',
  document: 'document',
  location: 'lieu',
  timelineEvent: 'événement',
  characterRelation: 'relation'
}

export const AI_LOG_ACTION_LABELS: Record<string, string> = {
  [AI_LOG_ACTIONS.authorized]: 'autorisé',
  [AI_LOG_ACTIONS.updated]: 'jeux changés',
  [AI_LOG_ACTIONS.revoked]: 'retiré',
  [AI_LOG_ACTIONS.expired]: 'expiré après 90 jours sans usage',
  [AI_LOG_ACTIONS.sessionsRevoked]: 'coupé (déconnexion partout ou compte désactivé)',
  [AI_LOG_ACTIONS.reused]: 'retiré (jeton réutilisé)',
  [AI_LOG_ACTIONS.created]: 'créé',
  [AI_LOG_ACTIONS.changed]: 'modifié',
  [AI_LOG_ACTIONS.deleted]: 'supprimé'
}
