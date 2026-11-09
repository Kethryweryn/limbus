// Confirmation avant de supprimer un élément d'écriture, la même depuis la liste et depuis sa fiche (US-186)
export const DELETE_CONFIRMATIONS = {
  character: 'Supprimer ce personnage ?',
  faction: 'Supprimer ce groupe ? Les personnages liés seront conservés.',
  intrigue: 'Supprimer cette intrigue ?',
  item: 'Supprimer cet objet ?',
  location: 'Supprimer ce lieu ? Les sessions liées seront conservées sans lieu.',
  document: 'Supprimer ce document ?',
  timelineEvent: 'Supprimer cet événement ?',
  // Une session qui a un paiement reçu ou une inscription est refusée par le serveur (SPEC-004 R3)
  session: 'Supprimer cette session ?'
} as const
