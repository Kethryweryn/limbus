import { setCookie } from 'h3'
import { requireAdmin } from '~/server/utils/auth'
import { adminModeSchema, readZodBody } from '~/server/utils/schemas'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readZodBody(event, adminModeSchema)

  setCookie(event, 'limbus_admin_mode', body.enabled ? '1' : '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: body.enabled ? 60 * 60 * 2 : 0
  })

  return { adminMode: body.enabled }
})
