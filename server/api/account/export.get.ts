import { requireUser } from '~/server/utils/auth'
import { exportAccountData } from '~/server/utils/accountDeletion'

// Télécharger mes données (US-076) : le compte et toutes mes fiches, en JSON
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  setHeader(event, 'Content-Disposition', 'attachment; filename="mes-donnees-limbus.json"')
  setHeader(event, 'Cache-Control', 'private, no-store')
  return await exportAccountData(user.id)
})
