<template>
  <div v-if="loading"></div>
  <div v-else-if="authenticated">
    <NuxtLayout>
      <NuxtRouteAnnouncer />
      <NuxtWelcome />
    </NuxtLayout>
  </div>
  <div v-else>
    <LoginScreen />
  </div>
</template>

<script setup lang="ts">
import LoginScreen from '~/components/LoginScreen.vue'

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