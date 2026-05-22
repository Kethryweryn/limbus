import { z, type ZodError, type ZodType } from 'zod'
import type { H3Event } from 'h3'

const optionalText = z.string().trim().optional().nullable()
const optionalBoolean = z.boolean().optional()
const requiredText = (field: string) => z.string().trim().min(1, `${field} is required`)
const requiredId = (field: string) => z.string().trim().min(1, `${field} is required`)
const sessionStatus = z.enum(['scheduled', 'postponed', 'cancelled', 'completed'])

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
  pitch: optionalText,
  background: optionalText,
  backgroundDocumentUrl: optionalText,
  costumeIndications: optionalText,
  gameId: requiredId('Game')
})

export const updateCharacterSchema = z.object({
  name: requiredText('Name').optional(),
  pitch: optionalText,
  background: optionalText,
  backgroundDocumentUrl: optionalText,
  costumeIndications: optionalText,
  gameId: requiredId('Game').optional(),
  published: optionalBoolean
})

export const playerSchema = z.object({
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

export const sessionAssignmentSchema = z.object({
  characterId: requiredId('Character'),
  playerId: optionalText,
  photoUrl: optionalText,
  notes: optionalText
})

export const sessionSchema = z.object({
  name: requiredText('Name'),
  gameId: requiredId('Game'),
  date: optionalText,
  locationId: optionalText,
  status: sessionStatus.optional().default('scheduled'),
  published: optionalBoolean,
  assignments: z.array(sessionAssignmentSchema).optional()
})

export const loginSchema = z.object({
  email: requiredText('Email'),
  password: requiredText('Password')
})
