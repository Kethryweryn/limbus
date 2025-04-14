<template>
  <div class="space-y-6">
    <h1 class="text-3xl font-bold">Tableau de bord</h1>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      <!-- Widget 1 -->
      <UCard class="shadow">
        <template #header>
          <div class="flex justify-between items-center">
            <span class="font-semibold">Nombre de jeux</span>
            <UIcon name="i-heroicons-cube" />
          </div>
        </template>
        <template #default>
          <div class="text-4xl font-bold">
            {{ pending ? '...' : dashboardData?.gamesCount ?? '–' }}
          </div>
        </template>
        <template #footer>
          <span class="text-sm text-gray-500">Mis à jour il y a 5 min</span>
        </template>
      </UCard>

      <!-- Widget 2 -->
      <UCard class="shadow">
        <template #header>
          <div class="flex justify-between items-center">
            <span class="font-semibold">Prochaine session</span>
            <UIcon name="i-heroicons-calendar-days" />
          </div>
        </template>
        <template #default>
          <div class="text-lg">
            {{ dashboardData?.nextSessionDate ? formatDate(dashboardData.nextSessionDate) : 'Aucune session prévue' }}
          </div>
        </template>
        <template #footer>
          <UButton size="xs" color="gray" variant="soft">Voir les sessions</UButton>
        </template>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { getFromStore, saveToStore } from '~/utils/storage'

const dashboardData = ref<any>(null)
const pending = ref(true)
const error = ref(null)

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric'
})

const updateDashboard = async () => {
  if (!navigator.onLine) {
    dashboardData.value = await getFromStore('dashboard', 'main')
    pending.value = false
    return
  }

  try {
    const { data } = await useFetch('/api/dashboard')
    dashboardData.value = data.value
    console.log('[dashboard] données reçues du serveur', data.value)
    await saveToStore('dashboard', 'main', data.value)
    console.log('[dashboard] données enregistrées dans le storage')
  } catch (e) {
    error.value = e
  } finally {
    pending.value = false
  }
}

const isOffline = ref(false)
const updateStatus = () => {
  isOffline.value = !navigator.onLine
}

onMounted(() => {
  updateStatus()
  window.addEventListener('online', updateStatus)
  window.addEventListener('offline', updateStatus)
  updateDashboard()
})

onUnmounted(() => {
  window.removeEventListener('online', updateStatus)
  window.removeEventListener('offline', updateStatus)
})
</script>