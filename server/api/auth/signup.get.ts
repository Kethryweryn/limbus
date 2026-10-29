import { isSignupOpen } from '~/server/utils/accounts'

// L'écran de connexion n'affiche « Créer un compte » que si l'inscription libre est ouverte (US-061)
export default defineEventHandler(() => ({ open: isSignupOpen() }))
