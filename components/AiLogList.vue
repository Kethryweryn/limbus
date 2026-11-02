<template>
  <!-- Journal des assistants d'IA (US-123, SPEC-014 R13) : autorisations, puis écritures aux lots suivants -->
  <div>
    <p v-if="!entries.length" class="text-sm text-gray-500">Rien au journal.</p>
    <ul v-else class="divide-y divide-gray-100 text-sm">
      <li v-for="entry in entries" :key="entry.id" class="py-1.5">
        <span class="text-gray-500">{{ formatLongDateTime(entry.createdAt) }}</span>
        · {{ entry.clientName }}
        <span v-if="showUser"> ({{ entry.user?.name || 'compte effacé' }})</span>
        · {{ entryLabel(entry) }}
        <span v-if="entry.game" class="text-gray-500"> · {{ entry.game.title }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { formatLongDateTime } from '~/utils/dates'
import { AI_LOG_ACTION_LABELS } from '~/utils/aiAssistants'
import type { ApiResponse } from '~/composables/useApiFetch'

type LogEntry = ApiResponse<'/api/account/ai-log'>[number]

withDefaults(defineProps<{ entries: LogEntry[], showUser?: boolean }>(), { showUser: false })

function entryLabel(entry: LogEntry) {
  const label = AI_LOG_ACTION_LABELS[entry.action] ?? entry.action
  return entry.targetName ? `${label} : ${entry.targetName}` : label
}
</script>
