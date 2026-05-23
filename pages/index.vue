<template>
  <div class="space-y-6">
    <h1 class="text-3xl font-bold">Tableau de bord</h1>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <UCard class="xl:col-span-2">
        <template #header>
          <div class="flex justify-between items-center">
            <span class="font-semibold">Prochaine session</span>
            <UIcon name="i-heroicons-calendar-days" />
          </div>
        </template>

        <div v-if="pending" class="text-gray-500">Chargement...</div>
        <div v-else-if="!dashboardData?.nextSession" class="text-gray-500">Aucune session prévue</div>
        <div v-else class="space-y-4">
          <div>
            <div class="text-xl font-semibold">{{ dashboardData.nextSession.name }}</div>
            <div class="text-sm text-gray-500">{{ dashboardData.nextSession.game.title }}</div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-gray-500">Date</span>
              <div class="font-medium">{{ formatDateTime(dashboardData.nextSession.date) }}</div>
            </div>
            <div>
              <span class="text-gray-500">Lieu</span>
              <div class="font-medium">{{ formatLocation(dashboardData.nextSession.location) }}</div>
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between text-sm mb-2">
              <span class="text-gray-500">Cast</span>
              <span class="font-medium">
                {{ dashboardData.nextSession.cast.assigned }}/{{ dashboardData.nextSession.cast.total }} rôles assignés
                ({{ dashboardData.nextSession.cast.percent }}%)
              </span>
            </div>
            <UProgress :model-value="dashboardData.nextSession.cast.percent" />
          </div>
        </div>

        <template #footer>
          <UButton size="xs" color="neutral" variant="soft" to="/sessions">Voir les sessions</UButton>
        </template>
      </UCard>

      <UCard>
        <template #header>
          <div class="flex justify-between items-center">
            <span class="font-semibold">Stats</span>
            <UIcon name="i-heroicons-chart-bar" />
          </div>
        </template>

        <div v-if="pending" class="text-gray-500">Chargement...</div>
        <div v-else class="space-y-5">
          <div class="grid grid-cols-1 gap-3">
            <div>
              <div class="text-3xl font-bold">{{ dashboardData?.stats.gamesCount ?? 0 }}</div>
              <div class="text-sm text-gray-500">Jeux</div>
            </div>
            <div>
              <div class="text-3xl font-bold">{{ dashboardData?.stats.totalParticipantsCount ?? 0 }}</div>
              <div class="text-sm text-gray-500">Participants au total</div>
            </div>
            <div>
              <div class="text-3xl font-bold">{{ dashboardData?.stats.participantsWhoPlayedCount ?? 0 }}</div>
              <div class="text-sm text-gray-500">Anciens participants</div>
            </div>
            <div>
              <div class="text-3xl font-bold">{{ dashboardData?.stats.neverCastParticipantsCount ?? 0 }}</div>
              <div class="text-sm text-gray-500">Participants jamais castés</div>
            </div>
          </div>

          <div>
            <h2 class="text-sm font-semibold mb-2">Sessions par jeu</h2>
            <div class="space-y-2">
              <div
                v-for="game in dashboardData?.stats.sessionsByGame || []"
                :key="game.id"
                class="flex justify-between gap-3 text-sm"
              >
                <span class="truncate">{{ game.title }}</span>
                <span class="font-medium">{{ game.sessionsCount }}</span>
              </div>
            </div>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { isOfflineMode } from '~/utils/connection'
import { getFromStore, saveToStore } from '~/utils/storage'

const dashboardData = ref<any>(null)
const pending = ref(true)
const error = ref(null)

const formatDateTime = (value: string) => new Date(value).toLocaleString('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

const formatLocation = (location: any) => {
  if (!location) return 'Non renseigné'
  return location.address ? `${location.name} - ${location.address}` : location.name
}

const updateDashboard = async () => {
  if (isOfflineMode()) {
    dashboardData.value = await getFromStore('dashboard', 'main')
    pending.value = false
    return
  }

  try {
    const data = await useApiFetch('/api/dashboard')
    dashboardData.value = data
    saveToStore('dashboard', 'main', data)
  } catch (e: any) {
    error.value = e
  } finally {
    pending.value = false
  }
}

const isOffline = ref(false)
const updateStatus = () => {
  const wasOffline = isOffline.value
  isOffline.value = isOfflineMode()
  if (!wasOffline && isOffline.value) {
    updateDashboard()
  }
}

onMounted(() => {
  updateStatus()
  window.addEventListener('online', updateStatus)
  window.addEventListener('offline', updateStatus)
  window.addEventListener('limbus:connection-change', updateStatus)
  updateDashboard()
})

onUnmounted(() => {
  window.removeEventListener('online', updateStatus)
  window.removeEventListener('offline', updateStatus)
  window.removeEventListener('limbus:connection-change', updateStatus)
})
</script>
