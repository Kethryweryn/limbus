<template>
  <UApp>
    <div v-if="authenticated">
      <NuxtPwaAssets />
      <NuxtLoadingIndicator />
      <div
        v-if="serverUnavailable"
        class="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-900"
      >
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>Serveur indisponible. Limbus utilise les données locales en lecture seule.</span>
          <UButton size="xs" color="warning" variant="soft" @click="retryServer">
            Réessayer
          </UButton>
        </div>
      </div>
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </div>
    <div v-else-if="isPublicRoute">
      <NuxtPwaAssets />
      <NuxtLoadingIndicator />
      <NuxtPage />
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
import { signOfflineAuth } from '~/utils/hashOfflineAuth'

useHead({
  title: 'Limbus',
  meta: [
    { name: 'description', content: 'Plateforme de conception collaborative de jeux de rôle grandeur nature.' },
    { name: 'theme-color', content: '#ffffff' }
  ],
  link: [
    { rel: 'icon', type: 'image/png', href: '/pwa-192x192.png' },
    { rel: 'apple-touch-icon', href: '/pwa-192x192.png', sizes: '192x192' },
    { rel: 'mask-icon', href: '/pwa-192x192.png', color: '#ffffff' }
  ]
})

const authenticated = ref(false)
const serverUnavailable = ref(false)
const route = useRoute()
const isPublicRoute = computed(() => route.path.startsWith('/public/'))
let authCheckInProgress = false

async function hasValidOfflineAuth() {
  const raw = localStorage.getItem('offlineAuth')
  if (!raw) return false

  try {
    const { payload, signature } = JSON.parse(raw)
    const expectedSig = await signOfflineAuth(payload, 'limbus-pwa-secret')
    return signature === expectedSig
  } catch {
    return false
  }
}

const checkAuth = async (forceServerCheck = false) => {
  if (!process.client) return
  if (authCheckInProgress) return

  authCheckInProgress = true

  serverUnavailable.value = isOfflineMode()

  if (!forceServerCheck && isOfflineMode()) {
    authenticated.value = await hasValidOfflineAuth()
    authCheckInProgress = false
    return
  }

  if (forceServerCheck && !navigator.onLine) {
    authenticated.value = await hasValidOfflineAuth()
    authCheckInProgress = false
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
      authenticated.value = await hasValidOfflineAuth()
      authCheckInProgress = false
      return
    }
    authenticated.value = false
    authCheckInProgress = false
    return
  }

  if (authData?.authenticated && authData?.user) {
    authenticated.value = true

    const payload = {
      name: authData.user.name,
      email: authData.user.email,
      role: authData.user.role,
      timestamp: new Date().toISOString()
    }

    const signature = await signOfflineAuth(payload, 'limbus-pwa-secret')

    localStorage.setItem('offlineAuth', JSON.stringify({
      payload,
      signature
    }))
    authCheckInProgress = false
    return
  }

  authenticated.value = false
  authCheckInProgress = false
}

const retryServer = async () => {
  setServerUnavailable(false)
  await checkAuth(true)
}

const checkAuthFromEvent = () => {
  checkAuth()
}

onMounted(() => {
  checkAuth()
  window.addEventListener('online', checkAuthFromEvent)
  window.addEventListener('limbus:connection-change', checkAuthFromEvent)
})

watch(() => route.fullPath, () => {
  if (serverUnavailable.value && navigator.onLine) {
    checkAuth(true)
  }
})

onUnmounted(() => {
  window.removeEventListener('online', checkAuthFromEvent)
  window.removeEventListener('limbus:connection-change', checkAuthFromEvent)
})
</script>
