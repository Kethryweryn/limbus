import { submitFormRegistration } from '~/server/utils/formRegistrations'

// Envoi du formulaire public (US-084) : une demande à confirmer par email, ou l'inscription d'une personne connectée
export default defineEventHandler(async (event) => {
  return await submitFormRegistration(event, getRouterParam(event, 'publicId'))
})
