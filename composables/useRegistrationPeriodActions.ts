import { computed, inject, provide, ref, type InjectionKey } from 'vue'
import { fetchByUrl, useApiAction, type ApiResponse } from '~/composables/useApiFetch'
import { apiErrorMessage, apiFieldErrors } from '~/utils/apiErrors'
import { getCachedResponse, saveCachedResponse } from '~/utils/storage'

// Bloc d'un jeu sur la page Inscriptions (US-117) : le vivier, ses personnes et les actions partagées par ses sections
// (vivier, sélection, invitations, prolongation)

/** Vivier lu avec ses personnes. */
export type RegistrationPeriod = ApiResponse<'/api/registration-periods'>[number]
export type PeriodRegistration = RegistrationPeriod['registrations'][number]
export type InvitationResult = ApiResponse<'/api/registration-periods/:id/invitations', 'post'>

type InfoColor = 'success' | 'warning'
type RegistrationAction = 'remind' | 'release' | 'withdraw' | 'resend'

const KEY: InjectionKey<ReturnType<typeof createActions>> = Symbol('registration-period-actions')
const DAY_MS = 24 * 60 * 60 * 1000

/** Date d'un champ date, en heure locale. */
export const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`

/** Message d'un envoi groupé : les personnes que l'email n'a pas atteintes, avec la raison. */
export const sendFailures = (failures: Array<{ participantName: string, message: string | null }>) =>
  failures.map((failure) => `${failure.participantName} (${failure.message})`)

// La page Inscriptions se lit hors ligne depuis sa dernière lecture (US-119) : un bloc relu après une action y reporte
// ses périodes, pour que l'appareil garde l'état le plus récent
const ALL_PERIODS = '/api/registration-periods'
async function keepPeriodsOffline(gameId: string, periods: RegistrationPeriod[]) {
  const cached = await getCachedResponse<RegistrationPeriod[]>(ALL_PERIODS)
  if (!cached) return
  await saveCachedResponse(ALL_PERIODS, [...cached.filter((period) => period.gameId !== gameId), ...periods])
}

function createActions(gameId: () => string) {
  const periods = ref<RegistrationPeriod[]>([])
  const errorMessage = ref('')
  const infoMessage = ref('')
  const infoColor = ref<InfoColor>('success')

  function inform(message: string, color: InfoColor = 'success') {
    infoColor.value = color
    infoMessage.value = message
  }

  async function refresh() {
    try {
      periods.value = await fetchByUrl<RegistrationPeriod[]>(`${ALL_PERIODS}?gameId=${encodeURIComponent(gameId())}`)
      errorMessage.value = ''
      // Un appareil sans stockage (navigation privée…) n'empêche pas d'afficher les périodes
      await keepPeriodsOffline(gameId(), periods.value).catch((error) => console.error('[storage] périodes d’inscription', error))
    } catch (err) {
      errorMessage.value = apiErrorMessage(err, 'Impossible de charger le vivier')
    }
  }

  // Une action sur une inscription, puis la relecture des périodes, réussite ou échec (un renvoi échoué a tout de même
  // invalidé l'ancien lien)
  async function request(send: () => Promise<unknown>, success: string, failure: string) {
    infoMessage.value = ''
    try {
      await send()
      await refresh()
      inform(success)
    } catch (err) {
      await refresh()
      errorMessage.value = apiErrorMessage(err, failure)
    }
  }

  // Une écriture sur une période, relue si elle réussit
  async function periodWrite(send: () => Promise<unknown>, failure: string) {
    try {
      await send()
      await refresh()
    } catch (err) {
      errorMessage.value = apiErrorMessage(err, failure)
    }
  }

  // Actions d'une organisatrice sur une inscription (US-005)
  // sessionId : l'action vise la place de la personne pour cette session ; sans elle, son invitation ou le vivier
  function registrationAction(registration: PeriodRegistration, action: RegistrationAction, sessionId: string | undefined, success: string, failure = 'Action impossible') {
    return request(() => useApiAction<unknown, string, 'POST'>(`/api/registrations/${registration.id}/${action}`, { method: 'POST', body: { sessionId: sessionId ?? null } }), success, failure)
  }

  async function remind(registration: PeriodRegistration, sessionId?: string) {
    const name = registration.participant.name
    if (!confirm(`Relancer ${name} ? Un email de rappel l’invite à reprendre ${sessionId ? 'l’email qui annonce sa place' : 'son email d’invitation'}, dont le lien reste valable.`)) return
    await registrationAction(registration, 'remind', sessionId, `Rappel envoyé à ${name}.`)
  }

  async function release(registration: PeriodRegistration, sessionId?: string) {
    const name = registration.participant.name
    if (!confirm(sessionId
      ? `Libérer la place de ${name} ? Son lien indiquera que sa présence à cette session est annulée. La liste d’attente vous proposera la personne suivante.`
      : `Libérer l’invitation de ${name} ? Son lien ne permettra plus de répondre. Vous pourrez la réinviter.`)) return
    await registrationAction(registration, 'release', sessionId, sessionId ? `Place de ${name} libérée.` : `Invitation de ${name} libérée.`)
  }

  // Avec une session : la personne en est retirée et reste dans le vivier (R19) ; sans session : elle sort du vivier (R5)
  async function withdraw(registration: PeriodRegistration, sessionId?: string) {
    const name = registration.participant.name
    if (!confirm(sessionId
      ? `Retirer ${name} de la session ? Ses personnages (PJ et PNJ) seront libérés, les trombinoscopes régénérés et l’équipe prévenue par email. Cette personne reste dans le vivier.`
      : `Retirer ${name} du vivier ? Ses présences aux sessions à venir seront annulées, son lien ne marchera plus et l’équipe sera prévenue par email.`)) return
    await registrationAction(registration, 'withdraw', sessionId, sessionId ? `${name} a été retirée de la session.` : `${name} a été retirée du vivier.`)
  }

  async function resend(registration: PeriodRegistration, sessionId?: string) {
    const name = registration.participant.name
    if (!confirm(`Envoyer un nouveau lien à ${name} ? Les liens envoyés précédemment ne fonctionneront plus.`)) return
    await registrationAction(registration, 'resend', sessionId, `Nouveau lien envoyé à ${name}.`, 'Renvoi impossible')
  }

  async function cancel(registration: PeriodRegistration) {
    const name = registration.participant.name
    if (!confirm(`Annuler l’invitation de ${name} ? Son lien ne fonctionnera plus.`)) return
    await request(() => useApiAction(`/api/registrations/${registration.id}`, { method: 'DELETE' }), `Invitation de ${name} annulée.`, 'Annulation impossible')
  }

  // Détail d'une inscription (US-005)
  const showDetailModal = ref(false)
  const detailId = ref<string | null>(null)
  function showDetail(registration: PeriodRegistration) {
    detailId.value = registration.id
    showDetailModal.value = true
  }

  // Prolongation d'une échéance (R20)
  const showExtension = ref(false)
  const extensionTarget = ref<PeriodRegistration | null>(null)
  const extensionSessionId = ref<string | undefined>(undefined)
  const extensionDate = ref('')
  const extensionError = ref('')
  const extending = ref(false)

  // Proposition : une semaine après l'échéance actuelle, ou après aujourd'hui si elle est passée
  function askExtension(registration: PeriodRegistration, sessionId?: string) {
    extensionTarget.value = registration
    extensionSessionId.value = sessionId
    const line = registration.sessionLines.find((candidate) => candidate.sessionId === sessionId)
    const due = sessionId ? line?.responseDueAt : registration.responseDueAt
    const current = due ? new Date(due) : null
    const from = current && current.getTime() > Date.now() ? current : new Date()
    extensionDate.value = isoDate(new Date(from.getTime() + 7 * DAY_MS))
    extensionError.value = ''
    showExtension.value = true
  }

  async function extend() {
    const registration = extensionTarget.value
    if (!registration) return
    extending.value = true
    extensionError.value = ''
    try {
      // Fin du jour choisi, en heure locale
      const responseDueAt = new Date(`${extensionDate.value}T23:59:59`).toISOString()
      await useApiAction(`/api/registrations/${registration.id}/extend`, { method: 'POST', body: { responseDueAt, sessionId: extensionSessionId.value ?? null } })
      showExtension.value = false
      await refresh()
      inform(`Échéance de ${registration.participant.name} prolongée.`)
    } catch (err) {
      extensionError.value = apiFieldErrors(err).responseDueAt || apiErrorMessage(err, 'Prolongation impossible')
    } finally {
      extending.value = false
    }
  }

  // Invitations à rejoindre le vivier (R4) : le vivier est relu avec les autres, pour que la modale reste à jour
  const showInviteForm = ref(false)
  const invitePeriodId = ref<string | null>(null)
  const inviteTarget = computed(() => periods.value.find((period) => period.id === invitePeriodId.value) ?? null)
  function invite(period: RegistrationPeriod) {
    invitePeriodId.value = period.id
    showInviteForm.value = true
  }

  async function invited(result: InvitationResult) {
    const failures = sendFailures(result.failures)
    inform([
      `${plural(result.invitedCount, 'invitation')}, ${plural(result.sentCount, 'email')} envoyé${result.sentCount > 1 ? 's' : ''}.`,
      failures.length ? `Non envoyés : ${failures.join(', ')}. Utilisez « Envoyer » une fois le problème réglé.` : ''
    ].filter(Boolean).join(' '), failures.length ? 'warning' : 'success')
    await refresh()
  }

  // Création et réglages du vivier
  const showForm = ref(false)
  const editedPeriod = ref<RegistrationPeriod | null>(null)
  function edit(period: RegistrationPeriod | null) {
    editedPeriod.value = period
    showForm.value = true
  }

  // Ouvrir et fermer à la main (R2)
  function setState(period: RegistrationPeriod, state: string) {
    const body = { gameId: period.gameId, state, updatedAt: period.updatedAt }
    return periodWrite(() => useApiAction(`/api/registration-periods/${period.id}`, { method: 'PUT', body }), 'Modification impossible')
  }

  async function remove(period: RegistrationPeriod) {
    if (!confirm('Supprimer le vivier de ce jeu ?')) return
    await periodWrite(() => useApiAction(`/api/registration-periods/${period.id}`, { method: 'DELETE' }), 'Suppression impossible')
  }

  // Lien de diffusion du vivier (R32), calculé par le serveur (absoluteAppUrl)
  async function copyDiffusionUrl(period: RegistrationPeriod) {
    try {
      await navigator.clipboard.writeText(period.diffusionUrl)
      inform('Lien de diffusion copié.')
    } catch {
      inform(`Copiez le lien à la main : ${period.diffusionUrl}`, 'warning')
    }
  }

  return {
    periods, errorMessage, infoMessage, infoColor, refresh,
    remind, release, withdraw, resend, cancel,
    showDetailModal, detailId, showDetail,
    showExtension, extensionTarget, extensionDate, extensionError, extending, askExtension, extend,
    showInviteForm, inviteTarget, invite, invited,
    showForm, editedPeriod, edit, setState, remove, copyDiffusionUrl
  }
}

/** Crée l'état du bloc d'un jeu et le rend à ses sections. */
export function provideRegistrationPeriodActions(gameId: () => string) {
  const actions = createActions(gameId)
  provide(KEY, actions)
  return actions
}

/** État du bloc d'un jeu, dans une de ses sections. */
export function useRegistrationPeriodActions() {
  const actions = inject(KEY)
  if (!actions) throw new Error('useRegistrationPeriodActions hors de RegistrationPeriodsPanel')
  return actions
}
