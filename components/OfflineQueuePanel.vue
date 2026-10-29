<template>
  <USlideover v-model:open="openProxy" title="Modifications faites hors ligne">
    <template #body>
      <div class="space-y-4">
        <p v-if="!operations.length" class="text-sm text-gray-500">
          Aucune modification en attente.
        </p>

        <UCard v-for="operation in operations" :key="operation.id">
          <div class="space-y-3">
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="font-medium">{{ summary(operation).element }}</div>
                <div class="text-sm text-gray-600">{{ summary(operation).action }}</div>
                <div class="text-xs text-gray-500">{{ formatDate(operation.createdAt) }}</div>
              </div>
              <UBadge :color="statusMeta(operation).color" variant="subtle">
                {{ statusMeta(operation).label }}
              </UBadge>
            </div>

            <p v-if="held.has(operation.id)" class="text-sm text-gray-600">
              Retenue : une modification précédente de cet élément est en erreur.
            </p>
            <p v-else-if="operation.status === 'error'" class="text-sm text-red-700">
              {{ operation.error }}
            </p>

            <!-- Conflit (US-050) : les seuls champs qui diffèrent, côte à côte -->
            <div v-if="operation.status === 'conflict'" class="space-y-2">
              <p class="text-sm text-red-700">
                {{ operation.method === 'DELETE'
                  ? 'Cet élément a été modifié par quelqu’un d’autre depuis que vous l’avez supprimé hors ligne.'
                  : 'Cet élément a été modifié par quelqu’un d’autre entre-temps.' }}
              </p>
              <table v-if="conflictFields(operation).length" class="w-full text-sm">
                <thead>
                  <tr class="text-left text-gray-500">
                    <th class="py-1 pr-2 font-medium">Champ</th>
                    <th class="py-1 pr-2 font-medium">Ma version</th>
                    <th class="py-1 font-medium">Version du serveur</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="field in conflictFields(operation)" :key="field.key" class="border-t border-gray-100 align-top">
                    <td class="py-1 pr-2 text-gray-600">{{ field.label }}</td>
                    <td class="py-1 pr-2 break-words">{{ formatValue(field.mine) }}</td>
                    <td class="py-1 break-words">{{ formatValue(field.theirs) }}</td>
                  </tr>
                </tbody>
              </table>
              <p v-else-if="operation.method !== 'DELETE'" class="text-sm text-gray-600">
                La version du serveur n’a pas pu être relue : comparez depuis la page de l’élément.
              </p>
              <div class="flex flex-wrap gap-2">
                <UButton size="sm" color="primary" @click="keepMine(operation)">
                  {{ operation.method === 'DELETE' ? 'Supprimer quand même' : 'Garder ma version' }}
                </UButton>
                <UButton size="sm" color="neutral" variant="soft" @click="abandon(operation)">
                  Garder celle du serveur
                </UButton>
              </div>
            </div>

            <div v-else class="flex flex-wrap gap-2">
              <UButton v-if="operation.status === 'error'" size="sm" color="primary" variant="soft" @click="retry(operation)">
                Renvoyer
              </UButton>
              <UButton size="sm" color="neutral" variant="soft" @click="abandon(operation)">
                Abandonner
              </UButton>
            </div>
          </div>
        </UCard>

        <p v-if="notice" class="text-sm text-gray-600">{{ notice }}</p>
        <UButton v-if="operations.length" color="error" variant="soft" @click="abandonAll">
          Tout abandonner
        </UButton>
      </div>
    </template>
  </USlideover>
</template>

<script setup>
import {
  abandonAllOperations,
  abandonOperation,
  conflictFields,
  getOfflineQueue,
  heldOperationIds,
  operationSummary,
  retryOperation
} from '~/utils/offlineSync'

const props = defineProps({
  open: { type: Boolean, default: false }
})
const emit = defineEmits(['update:open', 'sync'])

const openProxy = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})
const operations = ref([])
const held = computed(() => heldOperationIds(operations.value))
const notice = ref('')

const summary = (operation) => operationSummary(operation)

const STATUS_META = {
  pending: { label: 'En attente', color: 'info' },
  syncing: { label: 'Envoi…', color: 'info' },
  error: { label: 'Erreur', color: 'error' },
  conflict: { label: 'Conflit', color: 'warning' }
}
const statusMeta = (operation) => held.value.has(operation.id)
  ? { label: 'Retenue', color: 'neutral' }
  : STATUS_META[operation.status] || STATUS_META.pending

const formatDate = (value) => new Date(value).toLocaleString('fr-FR', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit'
})

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non'
  if (Array.isArray(value)) return `${value.length} élément${value.length > 1 ? 's' : ''}`
  if (typeof value === 'object' && (value.name || value.title)) return value.name || value.title
  // Textes rangés par identifiant (notes par jeu, US-069) : les textes seuls, sans les identifiants
  if (typeof value === 'object' && Object.values(value).every((item) => item === null || typeof item === 'string')) {
    return formatValue(Object.values(value).filter(Boolean).join(' / '))
  }
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 120)
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && !Number.isNaN(new Date(value).getTime())) {
    return formatDate(value)
  }
  const text = String(value)
  return text.length > 160 ? `${text.slice(0, 160)}…` : text
}

async function refresh() {
  operations.value = await getOfflineQueue()
}

// Le cache de l'appareil montre encore la modification abandonnée : il se met à jour au prochain chargement
function afterAbandon() {
  notice.value = navigator.onLine
    ? 'Rechargez la page pour retrouver la version du serveur.'
    : 'L’affichage reprendra la version du serveur au retour du réseau.'
}

async function abandon(operation) {
  const count = await abandonOperation(operation.id)
  if (count > 1) notice.value = `${count} modifications abandonnées : la création et ce qui la suivait.`
  else afterAbandon()
  await refresh()
}

async function abandonAll() {
  if (!confirm(`Abandonner les ${operations.value.length} modification(s) faites hors ligne ? Elles seront perdues.`)) return
  await abandonAllOperations()
  afterAbandon()
  await refresh()
}

async function retry(operation) {
  await retryOperation(operation.id)
  emit('sync')
}

async function keepMine(operation) {
  await retryOperation(operation.id, true)
  emit('sync')
}

watch(() => props.open, (value) => {
  if (value) {
    notice.value = ''
    refresh()
  }
})

onMounted(() => {
  refresh()
  window.addEventListener('limbus:sync-queue-change', refresh)
})
onUnmounted(() => window.removeEventListener('limbus:sync-queue-change', refresh))
</script>
