import { z } from 'zod'

// Messages par défaut de zod en français, pour tout le serveur dès son démarrage (US-210) : routes comme outils des
// assistants d'IA, quel que soit l'ordre dans lequel leurs schémas sont chargés
export default defineNitroPlugin(() => {
  z.config(z.locales.fr())
})
