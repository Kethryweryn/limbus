<template>
  <UApp>
    <!-- Bandeaux collés en haut de l'écran : ils restent visibles quand la page défile (SPEC-010, R15 ; US-257) -->
    <div ref="banners" class="sticky top-0 z-40">
      <!-- Nouvelle version proposée, sur toutes les pages, au-dessus des autres bandeaux (US-254, US-256, ADR-0093) -->
      <AppUpdateBanner />
      <!-- Bandeaux de connexion, dans l'application ouverte par un compte seulement -->
      <template v-if="inApp">
        <div
          v-if="serverUnavailable"
          class="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-900"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span v-if="offlineDisabled">Pas de connexion au serveur : le hors ligne est désactivé sur cet appareil, rien n’y est gardé. Les modifications et les actions attendent la connexion.</span>
            <span v-else>Pas de connexion au serveur : les modifications des fiches sont gardées sur l’appareil et partiront quand la connexion reviendra. Les envois et les autres actions attendent la connexion.</span>
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
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span>
              Modifications faites hors ligne : {{ syncSummary }}.
            </span>
            <UButton size="xs" :color="syncErrorCount ? 'error' : 'info'" variant="soft" @click="showSyncPanel = true">
              Voir les modifications
            </UButton>
          </div>
        </div>
      </template>
    </div>
    <!-- Pages autonomes (liens personnels, accès au compte, page publique) : même rendu connecté ou non, sans bandeaux de
         synchronisation. Elles ne changent pas de bloc quand la connexion est vérifiée, donc ne se remontent pas : la
         confirmation d'une adresse ne part qu'une fois -->
    <div v-if="screen === 'standalone'">
      <!-- Manifeste de l'application : les liens personnels gardent leurs propres métadonnées, en mode clair -->
      <NuxtPwaAssets v-if="!isPersonalLinkRoute" />
      <NuxtLoadingIndicator />
      <NuxtPage />
    </div>
    <!-- Adresse pas encore confirmée (R5) : seul le renvoi du lien est possible -->
    <div v-else-if="screen === 'unconfirmed'">
      <NuxtPwaAssets />
      <UnconfirmedAccountScreen :email="unconfirmedEmail" />
    </div>
    <!-- Conditions d'utilisation à accepter (US-111) : les pages légales restent lisibles -->
    <div v-else-if="screen === 'terms'">
      <NuxtPwaAssets />
      <TermsAcceptanceScreen @accepted="termsPending = false" />
    </div>
    <div v-else-if="inApp">
      <NuxtPwaAssets />
      <NuxtLoadingIndicator />
      <OfflineQueuePanel v-model:open="showSyncPanel" @sync="syncPendingChanges" />
      <NuxtLayout>
        <!-- Clé changée après l'envoi des modifications faites hors ligne : la page se relit sans recharger l'application
             (US-255) -->
        <NuxtPage :key="pageGeneration" />
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
    <div v-else-if="screen === 'open'">
      <NuxtPwaAssets />
      <NuxtLoadingIndicator />
      <NuxtPage />
    </div>
    <div v-else-if="screen === 'loading'">
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
import { onUnmounted, useHead, useRoute, useRouter } from '#imports'
import LoginScreen from '~/components/LoginScreen.vue'
import UnconfirmedAccountScreen from '~/components/UnconfirmedAccountScreen.vue'
import { isOfflineMode, isServerUnavailableError, setServerUnavailable } from '~/utils/connection'
import { isOfflineDisabled, OFFLINE_DISABLED_KEY } from '~/utils/offlineDevice'
import { claimOfflineData, clearPendingLogout, getOfflineAuth, hasPendingLogout, rememberOfflineAuth } from '~/utils/storage'
import { getOfflineQueue, processOfflineQueue } from '~/utils/offlineSync'
import { refreshDownloads } from '~/utils/offlineDownload'
import OfflineQueuePanel from '~/components/OfflineQueuePanel.vue'
import TermsAcceptanceScreen from '~/components/TermsAcceptanceScreen.vue'
import { LEGAL_PAGES } from '~/utils/legal'
import { DeferredRefresh, isTyping } from '~/utils/pageRefresh'

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
const termsPending = ref(false)
const authReady = ref(false)
const serverUnavailable = ref(false)
// Hors ligne désactivé sur cet appareil (SPEC-019, R6) : le bandeau ne promet pas de garder les modifications
const offlineDisabled = ref(false)
const readOfflineSetting = () => { offlineDisabled.value = isOfflineDisabled() }
// Réglage changé dans un autre onglet
const readOfflineSettingFromStorage = (event: StorageEvent) => { if (event.key === null || event.key === OFFLINE_DISABLED_KEY) readOfflineSetting() }
const syncing = ref(false)
// Relecture de la page après l'envoi de la file (US-255, R7) : la page est remontée, jamais pendant une saisie ni dans une
// fenêtre ouverte ; elle attend alors la fin de la saisie, ou le changement de page, qui la relit de toute façon
const pageGeneration = ref(0)
const pageRefresh = new DeferredRefresh(
  () => Boolean(document.querySelector('[role="dialog"]')) || isTyping(document.activeElement as HTMLElement | null),
  () => {
    // La page remontée rend la position de défilement, comme le faisait le rechargement du navigateur
    const scroll = window.scrollY
    nuxtApp.hooks.hookOnce('page:finish', () => { window.scrollTo(0, scroll) })
    pageGeneration.value++
  }
)
const PAGE_REFRESH_CHECK_MS = 1000
let pageRefreshTimer: number | undefined
const refreshPageAfterSync = () => {
  if (pageRefresh.request() || pageRefreshTimer !== undefined) return
  pageRefreshTimer = window.setInterval(() => {
    if (pageRefresh.tick() || !pageRefresh.isPending) stopPageRefreshTimer()
  }, PAGE_REFRESH_CHECK_MS)
}
const stopPageRefreshTimer = () => {
  window.clearInterval(pageRefreshTimer)
  pageRefreshTimer = undefined
}
const pendingSyncCount = ref(0)
const syncErrorCount = ref(0)
const showSyncPanel = ref(false)
const syncSummary = computed(() => [
  pendingSyncCount.value && `${pendingSyncCount.value} en attente`,
  syncErrorCount.value && `${syncErrorCount.value} ${syncErrorCount.value > 1 ? 'erreurs' : 'erreur'}`
].filter(Boolean).join(', '))
const toast = useToast()
const nuxtApp = useNuxtApp()
const route = useRoute()
// Route visée par la navigation : useRoute() suit la page affichée, et sous l'écran de connexion aucune page ne
// l'est, donc il ne changerait pas en suivant un lien de cet écran
const router = useRouter()
const currentPath = computed(() => router.currentRoute.value.path)
// Pages légales (US-110) : lisibles sans compte, et avant d'accepter les conditions
const isLegalRoute = computed(() => LEGAL_PAGES.some((page) => currentPath.value === page.to))
// Pages légales, nouveautés (US-147) et invitation à un jeu (US-064) : ouvertes sans connexion, mais une fois connecté
// elles suivent les conditions d'utilisation (les pages légales restent lisibles, les autres attendent leur acceptation).
// Toute autre page ouverte sans connexion est autonome (STANDALONE_PREFIXES)
const isOpenRoute = computed(() => isLegalRoute.value || currentPath.value === '/nouveautes' || currentPath.value.startsWith('/invitations/'))
// Liens personnels d'inscription (US-004) et de confirmation de présence (US-024), lien de diffusion (US-084)
const isPersonalLinkRoute = computed(() => ['/inscription/', '/presence/', '/i/'].some((prefix) => currentPath.value.startsWith(prefix)))
// Pages autonomes : liens personnels, accès au compte (inscription, confirmation, mot de passe, EPIC-013), page publique
// d'un jeu (US-019)
const isStandaloneRoute = computed(() => isPersonalLinkRoute.value || ['/acces/', '/public/'].some((prefix) => currentPath.value.startsWith(prefix)))
// Écran affiché, dans l'ordre des priorités ; « app » est l'application ouverte par un compte, seule à montrer les
// bandeaux de connexion
const screen = computed(() => {
  if (isStandaloneRoute.value) return 'standalone'
  if (unconfirmedEmail.value && !isOpenRoute.value) return 'unconfirmed'
  if (authenticated.value && termsPending.value && !isLegalRoute.value && currentPath.value !== '/logout') return 'terms'
  if (authenticated.value) return 'app'
  if (isOpenRoute.value) return 'open'
  return authReady.value ? 'login' : 'loading'
})
const inApp = computed(() => screen.value === 'app')
// Un champ qui prend le focus, ou une ancre, s'arrête sous les bandeaux collés et non derrière eux (US-257)
const banners = useTemplateRef<HTMLElement>('banners')
let bannersObserver: ResizeObserver | undefined
let authCheckInProgress = false
// Un réseau qui ne répond pas ne retient pas l'application : passé ce délai, elle ouvre ce qui est sur l'appareil
const AUTH_CHECK_TIMEOUT_MS = 10_000

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
    authData = await $fetch('/api/auth/me', { timeout: AUTH_CHECK_TIMEOUT_MS })
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
    termsPending.value = 'termsAccepted' in authData && authData.termsAccepted === false

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

// Jeux téléchargés remis à jour, après l'envoi des modifications en attente (SPEC-019, R14)
const refreshOfflineGames = () => {
  if (authenticated.value && navigator.onLine && !serverUnavailable.value && !isOfflineDisabled()) refreshDownloads().catch(() => {})
}

const checkAuthFromEvent = async () => {
  await checkAuth()
  if (navigator.onLine && !serverUnavailable.value) {
    await syncPendingChanges()
    refreshOfflineGames()
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
    // Tout est passé : la page reprend les données du serveur, sans recharger l'application (US-255). Sinon, le panneau
    // montre ce qui reste
    if (results.every((result) => result.ok)) {
      toast.add({ title: 'Modifications envoyées', description: 'Les modifications faites hors ligne sont enregistrées.', color: 'success' })
      refreshPageAfterSync()
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
  readOfflineSetting()
  window.addEventListener('limbus:offline-setting', readOfflineSetting)
  if (banners.value) {
    bannersObserver = new ResizeObserver(([entry]) => {
      document.documentElement.style.scrollPaddingTop = `${Math.ceil(entry?.contentRect.height ?? 0)}px`
    })
    bannersObserver.observe(banners.value)
  }
  window.addEventListener('storage', readOfflineSettingFromStorage)
  window.addEventListener('online', checkAuthFromEvent)
  window.addEventListener('limbus:connection-change', checkAuthFromEvent)
  window.addEventListener('limbus:sync-queue-change', refreshQueueState)
  window.addEventListener('limbus:offline-queued', notifyOfflineQueued)
  window.addEventListener('limbus:auth-change', checkAuthAfterLogout)
  // À l'ouverture, le serveur est toujours interrogé si le réseau est là : l'indisponibilité notée dans l'onglet
  // peut être ancienne, ou venir d'une requête coupée par un rechargement
  await checkAuth(true)
  // Modifications laissées en attente : elles partent dès l'ouverture, si le serveur répond (US-052)
  if (authenticated.value && navigator.onLine && !serverUnavailable.value) {
    await syncPendingChanges()
    refreshOfflineGames()
  }
})

// La page arrivée a lu ses données : une relecture en attente n'a plus lieu d'être
watch(() => route.path, () => { pageRefresh.cancel() })

watch(() => route.fullPath, () => {
  if (serverUnavailable.value && navigator.onLine) {
    checkAuth(true).then(syncPendingChanges)
  }
})

onUnmounted(() => {
  stopPageRefreshTimer()
  window.removeEventListener('limbus:offline-setting', readOfflineSetting)
  bannersObserver?.disconnect()
  window.removeEventListener('storage', readOfflineSettingFromStorage)
  window.removeEventListener('online', checkAuthFromEvent)
  window.removeEventListener('limbus:connection-change', checkAuthFromEvent)
  window.removeEventListener('limbus:sync-queue-change', refreshQueueState)
  window.removeEventListener('limbus:offline-queued', notifyOfflineQueued)
  window.removeEventListener('limbus:auth-change', checkAuthAfterLogout)
})
</script>
