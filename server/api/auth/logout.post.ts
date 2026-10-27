import { clearAuthCookie } from '~/server/utils/auth'

export default defineEventHandler((event) => {
  clearAuthCookie(event)
  return { success: true }
})
