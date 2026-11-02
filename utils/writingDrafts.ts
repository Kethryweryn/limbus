import type { ApiResponse } from '~/composables/useApiFetch'

// Éléments du jeu en cours d'édition (US-115) : leurs champs tels que l'API les rend, sans les éléments liés, que
// le formulaire tient en identifiants. Une liste rend moins de liens que la fiche : le brouillon n'en dépend pas.
type Draft<Row, Links extends keyof Row> = Partial<Omit<Row, Links>>
type Linked = Array<{ id: string }>

export type GameDraft = Draft<ApiResponse<'/api/games/:id'>, 'owner' | 'shares'>

export type CharacterDraft = Draft<ApiResponse<'/api/characters/:id'>, 'game' | 'intrigues' | 'factions'>
  & { factionIds?: string[], factions?: Linked }

export type FactionDraft = Draft<ApiResponse<'/api/factions/:id'>, 'game' | 'characters' | 'intrigues'>
  & { characterIds?: string[], characters?: Linked }

export type IntrigueDraft = Draft<ApiResponse<'/api/intrigues/:id'>, 'game' | 'characters' | 'factions' | 'items'>
  & { characterIds?: string[], factionIds?: string[], itemIds?: string[], characters?: Linked, factions?: Linked, items?: Linked }

export type ItemDraft = Draft<ApiResponse<'/api/items/:id'>, 'game' | 'locationCharacter' | 'characters' | 'intrigues'>
  & { characterIds?: string[], intrigueIds?: string[], characters?: Linked, intrigues?: Linked, locationCharacter?: { id: string } | null }

export type DocumentDraft = Draft<ApiResponse<'/api/documents/:id'>, 'game' | 'character' | 'characters' | 'factions'>
  & { characterIds?: string[], factionIds?: string[], characters?: Linked, factions?: Linked, character?: { id: string } | null }

export type LocationDraft = Draft<ApiResponse<'/api/locations/:id'>, 'game'>

export type TimelineEventDraft = Draft<ApiResponse<'/api/timeline-events/:id'>, 'game' | 'characters' | 'factions' | 'intrigues' | 'items'>
  & { characterIds?: string[], factionIds?: string[], intrigueIds?: string[], itemIds?: string[] }

/** Groupe proposé dans un formulaire : seuls ceux du jeu choisi sont proposés. */
export type FactionOption = { id: string, name: string, gameId: string }

/** Personnage proposé dans un formulaire. */
export type CharacterOption = { id: string, name: string, gameId: string, type: string }

/** Jeu proposé dans un formulaire, avec son attribut d'équilibre (US-091). */
export type GameOption = { id: string, title: string, balanceAttribute?: string | null, balanceValues?: string[] }
