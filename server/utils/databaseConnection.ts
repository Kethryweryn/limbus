// Connexion de Prisma à PostgreSQL (US-194, ADR-0076). La session est en UTC, quel que soit le fuseau du serveur : l'adaptateur
// pg de Prisma 7 échange les dates sans fuseau, que PostgreSQL lirait sinon dans le sien (Europe/Paris en production),
// d'où des instants décalés sur une colonne timestamptz (prisma/orm#26786, #28629).
export const SESSION_TIME_ZONE = 'UTC'

export function pgAdapterOptions(connectionString: string) {
  return { connectionString, options: `-c TimeZone=${SESSION_TIME_ZONE}` }
}
