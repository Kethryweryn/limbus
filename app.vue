<template>
  <UApp>
    <!-- Lien personnel d'inscription (US-004) : même rendu connecté ou non, sans bandeaux de synchronisation -->
    <div v-if="isPersonalLinkRoute">
      <NuxtLoadingIndicator />
      <NuxtPage />
    </div>
    <!-- Adresse pas encore confirmée (R5) : seul le renvoi du lien est possible -->
    <div v-else-if="unconfirmedEmail && !isPublicRoute">
      <NuxtPwaAssets />
      <UnconfirmedAccountScreen :email="unconfirmedEmail" />
    </div>
    <div v-else-if="authenticated">
      <NuxtPwaAssets />
      <NuxtLoadingIndicator />
      <div
        v-if="serverUnavailable"
        class="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-900"
      >
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>Serveur indisponible. Les modifications sont enregistrées localement et seront synchronisées au retour serveur.</span>
          <UButton size="xs" color="warning" variant="soft" @click="retryServer">
            Réessayer
          </UButton>
        </div>
      </div>
      <!-- Modifications faites hors ligne (US-049) : le bandeau ouvre leur liste -->
      <div
        v-if="pendingSyncCount || syncErrorCount"
        class="border-b px-4 py-2 text-sm"
        :class="syncErrorCount ? 'bg-red-50 border-red-200 text-red-900' : 'bg-blue-50 border-blue-200 text-blue-900'"
      >
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Modifications faites hors ligne : {{ syncSummary }}.
          </span>
          <UButton size="xs" :color="syncErrorCount ? 'error' : 'info'" variant="soft" @click="showSyncPanel = true">
            Voir les modifications
          </UButton>
        </div>
      </div>
      <OfflineQueuePanel v-model:open="showSyncPanel" @sync="syncPendingChanges" />
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
      <div
        v-if="syncing"
        class="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 backdrop-blur-sm"
      >
        <div class="rounded bg-white px-6 py-5 text-center shadow-xl">
          <div class="text-lg font-semibold">Synchronisation en cours</div>
          <div class="mt-1 text-sm text-gray-500">Les modifications hors ligne sont envoyées au serveur.</div>
        </div>
      </div>
    </div>
    <div v-else-if="isPublicRoute">
      <NuxtPwaAssets />
      <NuxtLoadingIndicator />
      <NuxtPage />
    </div>
    <div v-else-if="!authReady">
      <NuxtPwaAssets />
      <NuxtLoadingIndicator />
      <div class="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <img
          src="/brand/limbus-logo-header.png"
          alt="Limbus"
          class="h-24 w-full max-w-xs object-contain opacity-90"
        >
      </div>
    </div>
    <div v-else>
      <NuxtPwaAssets />
      <NuxtLoadingIndicator />
      <LoginScreen />
    </div>
  </UApp>
</template>

<script setup lang="ts">
import { onUnmounted, useHead, useRoute } from '#imports'
import LoginScreen from '~/components/LoginScreen.vue'
import UnconfirmedAccountScreen from '~/components/UnconfirmedAccountScreen.vue'
import { isOfflineMode, isServerUnavailableError, setServerUnavailable } from '~/utils/connection'
import { claimOfflineData, clearPendingLogout, getOfflineAuth, hasPendingLogout, rememberOfflineAuth } from '~/utils/storage'
import { getOfflineQueue, processOfflineQueue } from '~/utils/offlineSync'
import OfflineQueuePanel from '~/components/OfflineQueuePanel.vue'

useHead({
  title: 'Limbus',
  meta: [
    { name: 'description', content: 'Plateforme de conception collaborative de jeux de rôle grandeur nature.' },
    { name: 'theme-color', content: '#ffffff' }
  ],
  link: [
    { rel: 'icon', type: 'image/png', href: '/pwa-192x192.png' },
    { rel: 'apple-touch-icon', href: '/pwa-192x192.png', sizes: '192x192' },
    { rel: 'shortcut icon', type: 'image/png', href: '/pwa-192x192.png' }
  ]
})

const authenticated = ref(false)
const unconfirmedEmail = ref('')
const authReady = ref(false)
const serverUnavailable = ref(false)
const syncing = ref(false)
const pendingSyncCount = ref(0)
const syncErrorCount = ref(0)
const showSyncPanel = ref(false)
const syncSummary = computed(() => [
  pendingSyncCount.value && `${pendingSyncCount.value} en attente`,
  syncErrorCount.value && `${syncErrorCount.value} ${syncErrorCount.value > 1 ? 'erreurs' : 'erreur'}`
].filter(Boolean).join(', '))
const toast = useToast()
const route = useRoute()
// /acces/ : inscription, confirmation et mot de passe, ouverts sans connexion (EPIC-013)
const isPublicRoute = computed(() => ['/public/', '/invitations/', '/acces/'].some((prefix) => route.path.startsWith(prefix)))
// Liens personnels d'inscription (US-004) et de confirmation de présence (US-024)
const isPersonalLinkRoute = computed(() => route.path.startsWith('/inscription/') || route.path.startsWith('/presence/'))
let authCheckInProgress = false

function hasValidOfflineAuth() {
  return Boolean(getOfflineAuth())
}

const checkAuth = async (forceServerCheck = false) => {
  if (!import.meta.client) return
  if (authCheckInProgress) return

  authCheckInProgress = true

  const finishAuthCheck = () => {
    authReady.value = true
    authCheckInProgress = false
  }

  serverUnavailable.value = isOfflineMode()

  // Déconnexion faite sans réseau (US-051) : elle part avant tout, sinon la session se rouvrirait
  if (hasPendingLogout()) {
    authenticated.value = false
    if (navigator.onLine) {
      try {
        await $fetch('/api/auth/logout', { method: 'POST' })
        clearPendingLogout()
      } catch (error) {
        if (!isServerUnavailableError(error)) clearPendingLogout()
      }
    }
    if (hasPendingLogout()) {
      finishAuthCheck()
      return
    }
  }

  if (!forceServerCheck && isOfflineMode()) {
    authenticated.value = hasValidOfflineAuth()
    finishAuthCheck()
    return
  }

  if (forceServerCheck && !navigator.onLine) {
    authenticated.value = hasValidOfflineAuth()
    finishAuthCheck()
    return
  }

  let authData
  try {
    authData = await $fetch('/api/auth/me')
    setServerUnavailable(false)
    serverUnavailable.value = false
  } catch (error) {
    if (isServerUnavailableError(error)) {
      setServerUnavailable(true)
      serverUnavailable.value = true
      authenticated.value = hasValidOfflineAuth()
      finishAuthCheck()
      return
    }
    authenticated.value = false
    finishAuthCheck()
    return
  }

  unconfirmedEmail.value = ''
  if (authData?.authenticated && 'user' in authData && authData.user && !authData.user.emailConfirmed) {
    authenticated.value = false
    unconfirmedEmail.value = authData.user.email
    finishAuthCheck()
    return
  }

  if (authData?.authenticated && 'user' in authData && authData.user) {
    authenticated.value = true

    await claimOfflineData(authData.user.id)
    rememberOfflineAuth(authData.user)
    finishAuthCheck()
    return
  }

  authenticated.value = false
  finishAuthCheck()
}

const retryServer = async () => {
  setServerUnavailable(false)
  await checkAuth(true)
  await syncPendingChanges()
}

const checkAuthFromEvent = async () => {
  await checkAuth()
  if (navigator.onLine && !serverUnavailable.value) {
    await syncPendingChanges()
  }
}

const refreshQueueState = async () => {
  const queue = await getOfflineQueue()
  pendingSyncCount.value = queue.filter((operation) => operation.status === 'pending' || operation.status === 'syncing').length
  syncErrorCount.value = queue.filter((operation) => operation.status === 'error' || operation.status === 'conflict').length
}

const syncPendingChanges = async () => {
  if (!import.meta.client || syncing.value || !navigator.onLine) return

  const queue = await getOfflineQueue()
  // Une modification restée « en cours d'envoi » (page fermée pendant l'envoi) repart aussi
  const pending = queue.filter((operation) => operation.status === 'pending' || operation.status === 'syncing')
  if (!pending.length) {
    await refreshQueueState()
    return
  }

  syncing.value = true
  try {
    const { results, aborted } = await processOfflineQueue()
    if (aborted) {
      await refreshQueueState()
      return
    }

    await refreshQueueState()
    // Tout est passé : la page reprend les données du serveur. Sinon, le panneau montre ce qui reste
    if (results.every((result) => result.ok)) {
      window.location.reload()
      return
    }
    if (results.some((result) => result.ok)) showSyncPanel.value = true
  } finally {
    syncing.value = false
  }
}

const notifyOfflineQueued = () => {
  toast.add({
    title: 'Enregistré sur l’appareil',
    description: 'La modification partira au retour du réseau.',
    color: 'info'
  })
}

// Déconnexion (US-051) : l'écran de connexion s'affiche sans recharger l'application, même sans réseau
const checkAuthAfterLogout = () => checkAuth(true)

onMounted(async () => {
  refreshQueueState()
  window.addEventListener('online', checkAuthFromEvent)
  window.addEventListener('limbus:connection-change', checkAuthFromEvent)
  window.addEventListener('limbus:sync-queue-change', refreshQueueState)
  window.addEventListener('limbus:offline-queued', notifyOfflineQueued)
  window.addEventListener('limbus:auth-change', checkAuthAfterLogout)
  await checkAuth()
  // Modifications laissées en attente : elles partent dès l'ouverture, si le serveur répond (US-052)
  if (authenticated.value && navigator.onLine && !serverUnavailable.value) {
    await syncPendingChanges()
  }
})

watch(() => route.fullPath, () => {
  if (serverUnavailable.value && navigator.onLine) {
    checkAuth(true).then(syncPendingChanges)
  }
})

onUnmounted(() => {
  window.removeEventListener('online', checkAuthFromEvent)
  window.removeEventListener('limbus:connection-change', checkAuthFromEvent)
  window.removeEventListener('limbus:sync-queue-change', refreshQueueState)
  window.removeEventListener('limbus:offline-queued', notifyOfflineQueued)
  window.removeEventListener('limbus:auth-change', checkAuthAfterLogout)
})
</script>
