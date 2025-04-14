<template>
  <div v-if="authenticated">
    <NuxtPwaAssets />
    <NuxtLoadingIndicator />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
  <div v-else>
    <NuxtPwaAssets />
    <NuxtLoadingIndicator />
    <LoginScreen />
  </div>
</template>

<script setup lang="ts">
import { useHead } from '#imports'
import LoginScreen from '~/components/LoginScreen.vue'
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

const checkAuth = async () => {
  if (!process.client) return

  if (!navigator.onLine) {
    const raw = localStorage.getItem('offlineAuth')
    if (raw) {
      try {
        const { payload, signature } = JSON.parse(raw)
        const expectedSig = await signOfflineAuth(payload, 'limbus-pwa-secret')

        if (signature === expectedSig) {
          authenticated.value = true
          return
        }
      } catch {
        // stockage illisible
      }
    }
    authenticated.value = false
    return
  }

  // Sinon, on tente la vérif en ligne
  const { data } = await useFetch('/api/auth/me')

  if (data.value?.authenticated && data.value?.user) {
    authenticated.value = true

    const payload = {
      name: data.value.user.name,
      email: data.value.user.email,
      role: data.value.user.role,
      timestamp: new Date().toISOString()
    }

    const signature = await signOfflineAuth(payload, 'limbus-pwa-secret')

    localStorage.setItem('offlineAuth', JSON.stringify({
      payload,
      signature
    }))
    return
  }

  authenticated.value = false
}

onMounted(() => {
  checkAuth()
})
</script>