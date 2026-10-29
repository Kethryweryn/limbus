import { answerAttendanceByToken } from '~/server/utils/attendance'
import { guardPublicRegistrationRequest } from '~/server/utils/publicRegistrations'
import { attendanceAnswerSchema, readZodBody } from '~/server/utils/schemas'

// Réponse par le lien personnel : « je viens » ou « je ne viens pas » (US-024)
export default defineEventHandler(async (event) => {
  guardPublicRegistrationRequest(event, 'write')
  const { answer } = await readZodBody(event, attendanceAnswerSchema)
  return await answerAttendanceByToken(getRouterParam(event, 'token'), answer)
})
