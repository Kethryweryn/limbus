import type { prisma } from '../../server/utils/prisma'

// Le client de la transaction du rechargement
export type Db = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

type Person = { id: string, name: string, email: string | null }

export type Profile = { phone: string, emergencyContactName: string, emergencyContactPhone: string, dietary: string | null }

// Ce qu'une étape de la vie d'un jeu reçoit du script (ADR-0066)
export type StageContext = {
  gameId: string
  title: string
  ownerId: string | undefined
  locationId: string | undefined
  characters: Array<{ id: string, name: string, type: string }>
  // Les fiches, par adresse fictive
  people: Map<string, Person>
  // Photo de chaque fiche qui en a une, par identifiant
  photos: Map<string, string>
  // Coordonnées des comptes de test, qui priment sur celles du formulaire (ADR-0042)
  profiles: Map<string, Profile>
  makeSlug: (value: string) => string
  // L'adresse réelle d'une personne fictive (ADR-0066)
  address: (fictionalEmail: string) => string
}
