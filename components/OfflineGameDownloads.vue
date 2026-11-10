<template>
  <!-- Télécharger un jeu pour le hors ligne (SPEC-019, R8 à R13, US-226) -->
  <div v-if="rows.length" class="space-y-3 border-t border-gray-100 pt-4">
    <div>
      <h3 class="font-medium">Télécharger un jeu</h3>
      <p class="text-sm text-gray-500">
        Garde sur l’appareil tout le jeu : listes, fiches, inscriptions et sessions, et pour les sessions à venir leurs PDF et
        les photos du cast. Le téléchargement garde aussi le contact d’urgence et les allergies des participants.
      </p>
      <p v-if="unavailableReason" class="mt-1 text-sm text-gray-600">{{ unavailableReason }}</p>
    </div>
    <ul class="space-y-2">
      <li v-for="row in rows" :key="row.id" class="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-200 p-2" :aria-label="row.title">
        <div class="text-sm">
          <div class="font-medium">{{ row.title }}</div>
          <div v-if="running === row.id && progress" class="text-gray-500">{{ progress.done }} / {{ progress.total }} éléments gardés…</div>
          <div v-else-if="row.date" class="text-gray-500">Téléchargé le {{ formatLongDateTime(row.date) }}</div>
          <div v-else class="text-gray-500">Pas encore téléchargé</div>
        </div>
        <UButton
          v-if="row.active"
          size="sm"
          color="primary"
          variant="soft"
          icon="i-heroicons-arrow-down-tray"
          :loading="running === row.id"
          :disabled="Boolean(unavailableReason) || (running !== null && running !== row.id)"
          @click="download(row)"
        >
          {{ row.date ? 'Télécharger de nouveau' : 'Télécharger' }}
        </UButton>
      </li>
    </ul>
    <UAlert v-if="message" :color="message.color" variant="soft" :description="message.text" />
  </div>
</template>

<script setup lang="ts">
import { isOfflineMode } from '~/utils/connection'
import { formatLongDateTime } from '~/utils/dates'
import { isArchivedGame } from '~/utils/games'
import { getCachedResponse } from '~/utils/storage'
import { DownloadInterrupted, downloadGame, forgetDownloadedGame, GameAccessLost, listDownloads, type DownloadProgress, type OfflineDownload } from '~/utils/offlineDownload'

const props = defineProps<{ disabled: boolean }>()
const emit = defineEmits<{ downloaded: [] }>()

type Game = { id: string, slug: string, title: string, published?: boolean | null }
type Row = { id: string, slug: string, title: string, active: boolean, date: string | null }

const games = ref<Game[]>([])
const downloads = ref<OfflineDownload[]>([])
const running = ref<string | null>(null)
const progress = ref<DownloadProgress | null>(null)
const message = ref<{ color: 'success' | 'error' | 'warning', text: string } | null>(null)
const offline = ref(false)

// Jeux actifs de la personne, et ceux déjà téléchargés, même archivés depuis (R8)
const rows = computed<Row[]>(() => {
  const byId = new Map<string, Row>()
  for (const game of games.value) {
    if (isArchivedGame(game)) continue
    byId.set(game.id, { id: game.id, slug: game.slug, title: game.title, active: true, date: null })
  }
  for (const download of downloads.value) {
    const row = byId.get(download.gameId)
    if (row) row.date = download.date
    else byId.set(download.gameId, { id: download.gameId, slug: '', title: download.title, active: false, date: download.date })
  }
  return [...byId.values()]
})

const unavailableReason = computed(() => {
  if (props.disabled) return 'Le hors ligne est désactivé sur cet appareil : rien ne peut y être téléchargé.'
  if (offline.value) return 'Pas de réseau : le téléchargement demande une connexion.'
  return ''
})

async function load() {
  offline.value = isOfflineMode()
  downloads.value = props.disabled ? [] : await listDownloads()
  try {
    // Lue sans être gardée : la liste des jeux ne revient pas sur l'appareil juste après un effacement ; sans réseau,
    // la copie déjà gardée suffit à afficher les boutons, indisponibles
    games.value = offline.value
      ? await getCachedResponse<Game[]>('/api/games') ?? []
      : await useApiFetch('/api/games')
  } catch {
    games.value = []
  }
}

async function download(row: Row) {
  message.value = null
  running.value = row.id
  progress.value = null
  try {
    await downloadGame(row, (value) => { progress.value = value })
    message.value = { color: 'success', text: `« ${row.title} » est téléchargé : il s’ouvre sans réseau sur cet appareil.` }
  } catch (error) {
    if (error instanceof GameAccessLost) {
      await forgetDownloadedGame(row.id)
      message.value = { color: 'warning', text: `« ${row.title} » n’est plus accessible : ce que l’appareil en gardait est effacé.` }
    } else if (error instanceof DownloadInterrupted) {
      message.value = { color: 'error', text: 'Le réseau est tombé pendant le téléchargement : ce qui est déjà gardé le reste. Recommencez quand le réseau revient.' }
    } else {
      message.value = { color: 'error', text: 'Le téléchargement a échoué. Réessayez.' }
    }
  } finally {
    running.value = null
    progress.value = null
    downloads.value = await listDownloads()
    emit('downloaded')
  }
}

const updateConnection = () => { offline.value = isOfflineMode() }

onMounted(async () => {
  await load()
  window.addEventListener('online', updateConnection)
  window.addEventListener('offline', updateConnection)
  window.addEventListener('limbus:connection-change', updateConnection)
})

onUnmounted(() => {
  window.removeEventListener('online', updateConnection)
  window.removeEventListener('offline', updateConnection)
  window.removeEventListener('limbus:connection-change', updateConnection)
})

watch(() => props.disabled, load)
</script>
