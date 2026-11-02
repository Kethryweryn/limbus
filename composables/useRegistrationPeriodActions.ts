import { computed, inject, provide, ref, type InjectionKey } from 'vue'
import { fetchByUrl, useApiAction, type ApiResponse } from '~/composables/useApiFetch'
import { apiErrorMessage, apiFieldErrors } from '~/utils/apiErrors'
import { REGISTRATION_PERIOD_STATES, REGISTRATION_STATUSES } from '~/utils/domain'

// Bloc d'un jeu sur la page Inscriptions (US-117) : les périodes, leurs inscriptions et les actions partagées par ses
// sections (période, sélection, invitations, prolongation)

/** Période lue avec ses inscriptions. */
export type RegistrationPeriod = ApiResponse<'/api/registration-periods'>[number]
export type PeriodRegistration = RegistrationPeriod['registrations'][number]
export type PeriodSessionLink = RegistrationPeriod['sessions'][number]
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
      periods.value = await fetchByUrl<RegistrationPeriod[]>(`/api/registration-periods?gameId=${encodeURIComponent(gameId())}`)
      errorMessage.value = ''
    } catch (err) {
      errorMessage.value = apiErrorMessage(err, 'Impossible de charger les périodes d’inscription')
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
  function registrationAction(registration: PeriodRegistration, action: RegistrationAction, success: string, failure = 'Action impossible') {
    return request(() => useApiAction<unknown, string, 'POST'>(`/api/registrations/${registration.id}/${action}`, { method: 'POST' }), success, failure)
  }

  // Une place retenue se relance, se prolonge et se libère comme une invitation (US-089)
  const isRetained = (registration: PeriodRegistration) => registration.status === REGISTRATION_STATUSES.retained

  async function remind(registration: PeriodRegistration) {
    const name = registration.participant.name
    if (!confirm(`Relancer ${name} ? Un email de rappel l’invite à reprendre ${isRetained(registration) ? 'l’email qui annonce sa place' : 'son email d’invitation'}, dont le lien reste valable.`)) return
    await registrationAction(registration, 'remind', `Rappel envoyé à ${name}.`)
  }

  async function release(registration: PeriodRegistration) {
    const name = registration.participant.name
    if (!confirm(isRetained(registration)
      ? `Libérer la place de ${name} ? Son lien indiquera que, sans confirmation dans le délai, sa place a été réattribuée. La liste d’attente vous proposera la personne suivante.`
      : `Libérer la place de ${name} ? Son lien indiquera que, sans réponse dans le délai, sa place a été réattribuée. Vous pourrez la réinviter.`)) return
    await registrationAction(registration, 'release', `Place de ${name} libérée.`)
  }

  async function withdraw(registration: PeriodRegistration) {
    const name = registration.participant.name
    // Inscription pas encore confirmée : pas encore de session ni de personnage
    const received = registration.status !== REGISTRATION_STATUSES.confirmed
    if (!confirm(received
      ? `Retirer l’inscription de ${name} ? L’équipe sera prévenue par email.`
      : `Retirer ${name} de la session ? Ses personnages (PJ et PNJ) seront libérés, les trombinoscopes régénérés et l’équipe prévenue par email.`)) return
    await registrationAction(registration, 'withdraw', received ? `Inscription de ${name} retirée.` : `${name} a été retirée de la session.`)
  }

  async function resend(registration: PeriodRegistration) {
    const name = registration.participant.name
    if (!confirm(`Envoyer un nouveau lien à ${name} ? Le lien envoyé précédemment ne fonctionnera plus.`)) return
    await registrationAction(registration, 'resend', `Nouveau lien envoyé à ${name}.`, 'Renvoi impossible')
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
  const extensionDate = ref('')
  const extensionError = ref('')
  const extending = ref(false)

  // Proposition : une semaine après l'échéance actuelle, ou après aujourd'hui si elle est passée
  function askExtension(registration: PeriodRegistration) {
    extensionTarget.value = registration
    const current = registration.responseDueAt ? new Date(registration.responseDueAt) : null
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
      await useApiAction(`/api/registrations/${registration.id}/extend`, { method: 'POST', body: { responseDueAt } })
      showExtension.value = false
      await refresh()
      inform(`Échéance de ${registration.participant.name} prolongée.`)
    } catch (err) {
      extensionError.value = apiFieldErrors(err).responseDueAt || apiErrorMessage(err, 'Prolongation impossible')
    } finally {
      extending.value = false
    }
  }

  // Invitations d'une période sur invitation (US-003) : la période et la session sont relues avec les périodes, pour que
  // la modale garde des décomptes à jour
  const showInviteForm = ref(false)
  const inviteIds = ref<{ periodId: string, sessionId: string } | null>(null)
  const inviteTarget = computed(() => {
    const ids = inviteIds.value
    const period = ids ? periods.value.find((entry) => entry.id === ids.periodId) : undefined
    const link = period?.sessions.find((entry) => entry.sessionId === ids?.sessionId)
    return period && link ? { period, link } : null
  })
  function invite(period: RegistrationPeriod, link: PeriodSessionLink) {
    inviteIds.value = { periodId: period.id, sessionId: link.sessionId }
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

  // Création et modification d'une période (US-002)
  const showForm = ref(false)
  const editedPeriod = ref<RegistrationPeriod | null>(null)
  function edit(period: RegistrationPeriod | null) {
    editedPeriod.value = period
    showForm.value = true
  }

  function savePeriod(period: RegistrationPeriod, changes: { state: string, closesAt?: null }) {
    const body = {
      name: period.name,
      gameId: period.gameId,
      closesAt: period.closesAt,
      responseDelayDays: period.responseDelayDays,
      sessions: period.sessions.map((link) => ({ sessionId: link.sessionId, seats: link.seats })),
      updatedAt: period.updatedAt,
      ...changes
    }
    return periodWrite(() => useApiAction(`/api/registration-periods/${period.id}`, { method: 'PUT', body }), 'Modification impossible')
  }

  const setState = (period: RegistrationPeriod, state: string) => savePeriod(period, { state })

  // Une date de clôture passée garderait la période clôturée (ADR-0020) : la rouvrir retire cette date
  async function reopen(period: RegistrationPeriod) {
    const closedByDate = Boolean(period.closesAt) && new Date(period.closesAt!).getTime() <= Date.now()
    if (closedByDate && !confirm('La date de clôture de cette période est passée. La rouvrir retire cette date. Continuer ?')) return
    await savePeriod(period, { state: REGISTRATION_PERIOD_STATES.open, ...(closedByDate ? { closesAt: null } : {}) })
  }

  async function remove(period: RegistrationPeriod) {
    if (!confirm(`Supprimer la période d’inscription « ${period.name} » ?`)) return
    await periodWrite(() => useApiAction(`/api/registration-periods/${period.id}`, { method: 'DELETE' }), 'Suppression impossible')
  }

  // Lien de diffusion d'une période en mode formulaire (R32), calculé par le serveur (absoluteAppUrl)
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
    showForm, editedPeriod, edit, setState, reopen, remove, copyDiffusionUrl
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
