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
  try {
    const { data } = await useFetch('/api/auth/me')
    authenticated.value = data.value?.authenticated
  } catch {
    authenticated.value = false
  }
}

onMounted(() => {
  checkAuth()
})
</script>