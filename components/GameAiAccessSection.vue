<template>
  <!-- Assistants d'IA sur un jeu, vus par sa propriétaire (US-123, SPEC-014 R5, R13) -->
  <div class="space-y-3 border-t border-gray-100 pt-4">
    <h3 class="font-semibold">Assistants d’IA</h3>
    <USwitch
      :model-value="aiForCoorganizers"
      :loading="saving"
      label="Les co-organisatrices peuvent y brancher une IA"
      description="Vous pouvez toujours brancher la vôtre. Désactivé, les assistants des co-organisatrices perdent aussitôt l’accès au jeu."
      @update:model-value="saveSetting"
    />
    <UAlert v-if="error" color="error" variant="soft" :description="error" />

    <div class="space-y-1 text-sm">
      <p v-if="loaded && !authorizations.length" class="text-gray-500">Aucun assistant n’a accès à ce jeu.</p>
      <div v-for="authorization in authorizations" :key="authorization.id">
        {{ authorization.client.name }}, autorisé par {{ authorization.user.name }}
        · {{ authorization.canWrite ? 'lecture et écriture' : 'lecture seule' }}
        <span v-if="!authorization.open" class="text-gray-500"> (sans accès : réglage désactivé)</span>
      </div>
    </div>

    <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-clock" @click="showLog = !showLog">
      {{ showLog ? 'Masquer le journal' : 'Voir le journal des assistants sur ce jeu' }}
    </UButton>
    <AiLogList v-if="showLog" :entries="log" show-user />
  </div>
</template>

<script setup lang="ts">
import { serverMessage } from '~/utils/apiErrors'
import type { ApiResponse } from '~/composables/useApiFetch'

type Access = ApiResponse<'/api/games/:id/ai-access'>

const props = defineProps<{ gameId: string }>()

const aiForCoorganizers = ref(false)
const authorizations = ref<Access['authorizations']>([])
const log = ref<Access['log']>([])
const loaded = ref(false)
const saving = ref(false)
const showLog = ref(false)
const error = ref('')

async function load() {
  try {
    const access = await useApiFetch(`/api/games/${props.gameId}/ai-access`)
    aiForCoorganizers.value = access.aiForCoorganizers
    authorizations.value = access.authorizations
    log.value = access.log
  } catch (err) {
    error.value = serverMessage(err, 'Impossible de charger les assistants du jeu.')
  } finally {
    loaded.value = true
  }
}

watch(() => props.gameId, load, { immediate: true })

async function saveSetting(value: boolean) {
  saving.value = true
  error.value = ''
  try {
    await useApiAction(`/api/games/${props.gameId}/ai-settings`, { method: 'PUT', body: { aiForCoorganizers: value } })
    await load()
  } catch (err) {
    error.value = serverMessage(err, 'Enregistrement impossible')
  } finally {
    saving.value = false
  }
}
</script>
