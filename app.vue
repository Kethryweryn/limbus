<script setup lang="ts">
const router = useRouter()
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
    if (!authenticated.value && router.currentRoute.value.path !== '/login') {
      router.replace('/login')
    }
  }
}

onMounted(() => {
  checkAuth()
})
</script>

<template>
  <div v-if="loading"></div>
  <div v-else-if="authenticated">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>