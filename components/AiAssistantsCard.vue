<template>
  <!-- Assistants connectés (US-123, SPEC-014) : autorisations du compte, leurs jeux, retrait et journal -->
  <UCard>
    <template #header><h2 class="font-semibold">Assistants d’IA connectés</h2></template>
    <div class="space-y-4">
      <p class="text-sm text-gray-500">
        Un assistant (Claude, ChatGPT, Mistral…) se branche depuis ses propres réglages, avec l’adresse
        <code class="rounded bg-gray-100 px-1">{{ mcpUrl }}</code>. Il ne voit que les jeux cochés ici.
      </p>

      <UAlert v-if="error" color="error" variant="soft" :description="error" />

      <p v-if="loaded && !authorizations.length" class="text-sm text-gray-500">Aucun assistant connecté.</p>

      <div v-for="authorization in authorizations" :key="authorization.id" class="space-y-2 rounded border border-gray-200 p-3">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div class="font-medium">{{ authorization.client.name }}</div>
            <div class="text-sm text-gray-500">
              {{ authorization.canWrite ? 'Lecture et écriture' : 'Lecture seule' }}
              · autorisé le {{ formatLongDate(authorization.createdAt) }}
              · dernier usage le {{ formatLongDateTime(authorization.lastUsedAt) }}
            </div>
          </div>
          <div class="flex gap-2">
            <UButton size="xs" color="neutral" variant="soft" @click="startEdit(authorization)">Changer les jeux</UButton>
            <UButton size="xs" color="error" variant="soft" :loading="revoking === authorization.id" @click="revoke(authorization)">Retirer</UButton>
          </div>
        </div>
        <ul class="text-sm">
          <li v-for="game in authorization.games" :key="game.id">
            {{ game.title }}
            <span v-if="!game.open" class="text-warning-600"> (fermé aux assistants par sa propriétaire)</span>
          </li>
          <li v-if="!authorization.games.length" class="text-gray-500">Aucun jeu.</li>
        </ul>
        <div v-if="editing === authorization.id" class="space-y-2 border-t border-gray-100 pt-2">
          <UCheckbox
            v-for="game in offered"
            :key="game.id"
            :model-value="editedGameIds.includes(game.id)"
            :label="game.owned ? game.title : `${game.title} (partagé avec vous)`"
            @update:model-value="toggleGame(game.id, $event === true)"
          />
          <div class="flex gap-2">
            <UButton size="xs" color="primary" :loading="saving" @click="saveGames(authorization.id)">Enregistrer</UButton>
            <UButton size="xs" color="neutral" variant="ghost" @click="editing = ''">Annuler</UButton>
          </div>
        </div>
      </div>

      <div class="border-t border-gray-100 pt-3">
        <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-clock" @click="toggleLog">
          {{ showLog ? 'Masquer le journal' : 'Voir le journal des assistants' }}
        </UButton>
        <AiLogList v-if="showLog" class="mt-2" :entries="log" />
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import { serverMessage } from '~/utils/apiErrors'
import { formatLongDate, formatLongDateTime } from '~/utils/dates'
import type { ApiResponse } from '~/composables/useApiFetch'

type Listing = ApiResponse<'/api/account/ai-authorizations'>
type Authorization = Listing['authorizations'][number]

const authorizations = ref<Authorization[]>([])
const offered = ref<Listing['games']>([])
const log = ref<ApiResponse<'/api/account/ai-log'>>([])
const loaded = ref(false)
const error = ref('')
const editing = ref('')
const editedGameIds = ref<string[]>([])
const saving = ref(false)
const revoking = ref('')
const showLog = ref(false)

const mcpUrl = computed(() => import.meta.client ? `${window.location.origin}/mcp` : '/mcp')

async function load() {
  try {
    const listing = await useApiFetch('/api/account/ai-authorizations')
    authorizations.value = listing.authorizations
    offered.value = listing.games
    if (showLog.value) log.value = await useApiFetch('/api/account/ai-log')
  } catch (err) {
    error.value = serverMessage(err, 'Impossible de charger les assistants.')
  } finally {
    loaded.value = true
  }
}

onMounted(load)

function startEdit(authorization: Authorization) {
  editing.value = authorization.id
  editedGameIds.value = authorization.games.map((game) => game.id).filter((id) => offered.value.some((game) => game.id === id))
}

function toggleGame(gameId: string, checked: boolean) {
  editedGameIds.value = checked ? [...editedGameIds.value, gameId] : editedGameIds.value.filter((value) => value !== gameId)
}

async function saveGames(id: string) {
  saving.value = true
  error.value = ''
  try {
    await useApiAction(`/api/account/ai-authorizations/${id}`, { method: 'PUT', body: { gameIds: editedGameIds.value } })
    editing.value = ''
    await load()
  } catch (err) {
    error.value = serverMessage(err, 'Enregistrement impossible')
  } finally {
    saving.value = false
  }
}

async function revoke(authorization: Authorization) {
  if (!confirm(`Retirer l’accès de ${authorization.client.name} ? Il ne pourra plus lire ni modifier vos jeux.`)) return
  revoking.value = authorization.id
  error.value = ''
  try {
    await useApiAction(`/api/account/ai-authorizations/${authorization.id}`, { method: 'DELETE' })
    await load()
  } catch (err) {
    error.value = serverMessage(err, 'Retrait impossible')
  } finally {
    revoking.value = ''
  }
}

async function toggleLog() {
  showLog.value = !showLog.value
  if (showLog.value) {
    try {
      log.value = await useApiFetch('/api/account/ai-log')
    } catch (err) {
      error.value = serverMessage(err, 'Impossible de charger le journal.')
    }
  }
}
</script>
