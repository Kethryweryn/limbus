<template>
  <UApp>
    <!-- Lien personnel d'inscription (US-004) : même rendu connecté ou non, sans bandeaux de synchronisation -->
    <div v-if="isPersonalLinkRoute">
      <NuxtLoadingIndicator />
      <NuxtPage />
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
      <div
        v-if="pendingSyncCount"
        class="bg-blue-50 border-b border-blue-200 px-4 py-2 text-sm text-blue-900"
      >
        {{ pendingSyncCount }} modification(s) hors ligne en attente de synchronisation.
      </div>
      <div
        v-if="syncErrors.length"
        class="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-900"
      >
        {{ syncErrors.length }} modification(s) n’ont pas pu être synchronisées. Vérifiez les conflits avant de continuer.
      </div>
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
import { isOfflineMode, isServerUnavailableError, setServerUnavailable } from '~/utils/connection'
import { claimOfflineData, getOfflineAuth, rememberOfflineAuth } from '~/utils/storage'
import { getOfflineQueue, processOfflineQueue } from '~/utils/offlineSync'

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
const authReady = ref(false)
const serverUnavailable = ref(false)
const syncing = ref(false)
const pendingSyncCount = ref(0)
const syncErrors = ref<string[]>([])
const route = useRoute()
const isPublicRoute = computed(() => route.path.startsWith('/public/') || route.path.startsWith('/invitations/'))
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
  syncErrors.value = queue.filter((operation) => operation.status === 'error').map((operation) => operation.error || 'Erreur de synchronisation')
}

const syncPendingChanges = async () => {
  if (!import.meta.client || syncing.value || !navigator.onLine) return

  const queue = await getOfflineQueue()
  const pending = queue.filter((operation) => operation.status === 'pending')
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

    syncErrors.value = results.filter((result) => !result.ok).map((result) => result.error || 'Erreur de synchronisation')
    await refreshQueueState()
    if (!syncErrors.value.length) {
      window.location.reload()
    }
  } finally {
    syncing.value = false
  }
}

onMounted(() => {
  checkAuth()
  refreshQueueState()
  window.addEventListener('online', checkAuthFromEvent)
  window.addEventListener('limbus:connection-change', checkAuthFromEvent)
  window.addEventListener('limbus:sync-queue-change', refreshQueueState)
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
})
</script>
