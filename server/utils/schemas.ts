import { z, type ZodError, type ZodType } from 'zod'
import type { H3Event } from 'h3'

const optionalText = z.string().trim().optional().nullable()
const optionalBoolean = z.boolean().optional()
const requiredText = (field: string) => z.string().trim().min(1, `${field} is required`)
const requiredId = (field: string) => z.string().trim().min(1, `${field} is required`)
const sessionStatus = z.enum(['scheduled', 'postponed', 'cancelled', 'completed'])
const intrigueLevel = z.enum(['main_story', 'main_character', 'major', 'minor'])
const characterType = z.enum(['pj', 'pnj'])
const sessionParticipantRole = z.enum(['participant', 'organizer', 'npc'])
const timelineTime = z.string().trim().regex(/^\d{2}:\d{2}$/, 'Time must use HH:mm format')

export async function readZodBody<T>(event: H3Event, schema: ZodType<T>): Promise<T> {
  return await readValidatedBody(event, (body) => {
    const result = schema.safeParse(body)
    if (result.success) return result.data

    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body',
      data: formatZodError(result.error)
    })
  })
}

function formatZodError(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message
  }))
}

export const createGameSchema = z.object({
  title: requiredText('Title'),
  description: optionalText,
  teaserUrl: optionalText,
  noteIntention: optionalText,
  publicPage: optionalBoolean
})

export const updateGameSchema = z.object({
  title: requiredText('Title').optional(),
  description: optionalText,
  teaserUrl: optionalText,
  noteIntention: optionalText,
  published: optionalBoolean,
  publicPage: optionalBoolean
})

export const createCharacterSchema = z.object({
  name: requiredText('Name'),
  type: characterType.default('pj'),
  pitch: optionalText,
  background: optionalText,
  backgroundDocumentUrl: optionalText,
  costumeIndications: optionalText,
  gameId: requiredId('Game'),
  factionIds: z.array(requiredId('Faction')).optional().default([])
})

export const updateCharacterSchema = z.object({
  name: requiredText('Name').optional(),
  type: characterType.optional(),
  pitch: optionalText,
  background: optionalText,
  backgroundDocumentUrl: optionalText,
  costumeIndications: optionalText,
  gameId: requiredId('Game').optional(),
  factionIds: z.array(requiredId('Faction')).optional(),
  published: optionalBoolean
})

export const factionSchema = z.object({
  name: requiredText('Name'),
  pitch: optionalText,
  background: optionalText,
  backgroundDocumentUrl: optionalText,
  costumeIndications: optionalText,
  gameId: requiredId('Game'),
  characterIds: z.array(requiredId('Character')).optional().default([]),
  published: optionalBoolean
})

export const intrigueSchema = z.object({
  name: requiredText('Name'),
  pitch: optionalText,
  description: optionalText,
  level: intrigueLevel.default('minor'),
  gameId: requiredId('Game'),
  characterIds: z.array(requiredId('Character')).optional().default([]),
  factionIds: z.array(requiredId('Faction')).optional().default([]),
  published: optionalBoolean
})

export const participantSchema = z.object({
  name: requiredText('Name'),
  email: optionalText,
  phone: optionalText,
  notes: optionalText,
  gameIds: z.array(requiredId('Game')).optional().default([]),
  published: optionalBoolean
})

export const locationSchema = z.object({
  name: requiredText('Name'),
  address: optionalText,
  notes: optionalText,
  gameId: requiredId('Game'),
  published: optionalBoolean
})

export const itemSchema = z.object({
  name: requiredText('Name'),
  description: optionalText,
  locationText: optionalText,
  locationCharacterId: optionalText,
  gameId: requiredId('Game'),
  characterIds: z.array(requiredId('Character')).optional().default([]),
  intrigueIds: z.array(requiredId('Intrigue')).optional().default([]),
  published: optionalBoolean
})

export const timelineEventSchema = z.object({
  name: requiredText('Name'),
  description: optionalText,
  day: z.coerce.number().int().min(1),
  time: timelineTime,
  requiredResponsibles: z.coerce.number().int().min(0).optional().default(0),
  gameId: requiredId('Game'),
  characterIds: z.array(requiredId('Character')).optional().default([]),
  factionIds: z.array(requiredId('Faction')).optional().default([]),
  intrigueIds: z.array(requiredId('Intrigue')).optional().default([]),
  itemIds: z.array(requiredId('Item')).optional().default([]),
  published: optionalBoolean
})

export const sessionTimelineSchema = z.object({
  assignments: z.array(z.object({
    timelineEventId: requiredId('TimelineEvent'),
    participantIds: z.array(requiredId('Participant')).optional().default([])
  })).optional().default([])
})

export const sessionAssignmentSchema = z.object({
  characterId: requiredId('Character'),
  participantId: optionalText,
  photoUrl: optionalText,
  notes: optionalText
})

export const sessionParticipantSchema = z.object({
  participantId: requiredId('Participant'),
  role: sessionParticipantRole
})

export const sessionSchema = z.object({
  name: requiredText('Name'),
  gameId: requiredId('Game'),
  date: optionalText,
  locationId: optionalText,
  status: sessionStatus.optional().default('scheduled'),
  published: optionalBoolean,
  assignments: z.array(sessionAssignmentSchema).optional(),
  participants: z.array(sessionParticipantSchema).optional().default([])
})

export const loginSchema = z.object({
  email: requiredText('Email'),
  password: requiredText('Password')
})
