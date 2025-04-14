<template>
  <div v-if="loading"></div>
  <div v-else-if="authenticated">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
  <div v-else>
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
    { rel: 'icon', type: 'image/png', href: '/icon-192x192.png' } // Adapte selon ton icon
  ]
})

const loading = ref(true)
const authenticated = ref(false)

const checkAuth = async () => {
  try {
    const { data } = await useFetch('/api/auth/me')
    authenticated.value = data.value?.authenticated
  } catch {
    authenticated.value = false
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  checkAuth()
})
</script>