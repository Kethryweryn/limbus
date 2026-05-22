<template>
  <div class="p-6 space-y-6">
    <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
      <div>
        <UButton to="/sessions" color="neutral" variant="ghost" icon="i-heroicons-arrow-left" class="mb-3">
          Sessions
        </UButton>
        <h1 class="text-2xl font-bold">{{ session?.name || 'Session' }}</h1>
        <p class="text-sm text-gray-500">
          {{ session?.game?.title || 'Jeu inconnu' }}
          <span v-if="session?.date"> · {{ formatDate(session.date) }}</span>
          <span v-if="session?.location"> · {{ session.location.name }}</span>
        </p>
      </div>
      <UBadge v-if="session" :color="statusMeta(session.status).color" variant="subtle">
        {{ statusMeta(session.status).label }}
      </UBadge>
    </div>

    <SessionCastForm
      v-if="session"
      :session="session"
      :characters="characters"
      :players="players"
      :on-save="saveCast"
    />

    <UCard v-else>
      Chargement...
    </UCard>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import SessionCastForm from '@/components/SessionCastForm.vue'

const route = useRoute()
const session = ref(null)
const characters = ref([])
const players = ref([])

const statusLabels = {
  scheduled: { label: 'Prévue', color: 'primary' },
  postponed: { label: 'Reportée', color: 'warning' },
  cancelled: { label: 'Annulée', color: 'error' },
  completed: { label: 'Terminée', color: 'success' }
}

const statusMeta = (status) => statusLabels[status] || statusLabels.scheduled

const formatDate = (value) => new Date(value).toLocaleString('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

async function loadData() {
  const [sessionData, charactersData, playersData] = await Promise.all([
    useApiFetch(`/api/sessions/${route.params.id}`),
    useApiFetch('/api/characters'),
    useApiFetch('/api/players')
  ])

  session.value = sessionData
  characters.value = charactersData
  players.value = playersData
}

async function saveCast(assignments) {
  if (!session.value) return

  session.value = await useApiFetch(`/api/sessions/${session.value.id}`, {
    method: 'PUT',
    body: {
      name: session.value.name,
      gameId: session.value.gameId,
      date: toDatetimeLocal(session.value.date),
      locationId: session.value.locationId || '',
      status: session.value.status || 'scheduled',
      published: session.value.published,
      assignments
    }
  })
}

function toDatetimeLocal(value) {
  if (!value) return ''
  const date = new Date(value)
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return offsetDate.toISOString().slice(0, 16)
}

onMounted(loadData)
</script>
