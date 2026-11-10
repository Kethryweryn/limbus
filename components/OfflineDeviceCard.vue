<template>
  <!-- Hors ligne sur cet appareil (SPEC-019, US-223 à US-225) : place prise, effacement, désactivation -->
  <UCard role="region" aria-labelledby="hors-ligne-appareil">
    <template #header>
      <h2 id="hors-ligne-appareil" class="font-semibold">Hors ligne sur cet appareil</h2>
      <p class="text-sm text-gray-500">Ces réglages valent pour cet appareil seulement : vos autres appareils gardent les leurs.</p>
    </template>
    <div class="space-y-4">
      <UAlert
        v-if="disabled"
        color="info"
        variant="soft"
        description="Le hors ligne est désactivé sur cet appareil : rien n’y est gardé, Limbus ne s’ouvre pas sans réseau, et une modification demande le réseau."
      />

      <div v-if="size" class="text-sm">
        <p v-if="size.data === null">Ce navigateur ne permet pas de mesurer la place prise par les données gardées.</p>
        <p v-else>Données gardées (pages, PDF, photos) : <strong>{{ formatBytes(size.data) }}</strong></p>
        <p v-if="size.total !== null" class="text-xs text-gray-500">
          Place totale réservée à Limbus par le navigateur, application comprise : {{ formatBytes(size.total) }}
        </p>
      </div>

      <UCheckbox
        :model-value="!disabled"
        :disabled="busy || !!confirming"
        label="Garder Limbus sur cet appareil pour le hors ligne"
        description="Décochée, rien n’est gardé sur l’appareil : à choisir sur un appareil prêté ou partagé."
        @update:model-value="(keep) => keep ? enable() : start('disable')"
      />

      <div v-if="!disabled && !confirming">
        <UButton color="neutral" variant="soft" icon="i-heroicons-trash" :disabled="busy" @click="start('erase')">
          Effacer les données de l’appareil
        </UButton>
        <p class="mt-1 text-sm text-gray-500">Vide les pages, PDF et photos gardés, sans vous déconnecter.</p>
      </div>

      <!-- Confirmation, avec les modifications faites sans réseau pas encore envoyées (R4) -->
      <div v-if="confirming" class="space-y-3 rounded border border-gray-200 p-3" role="group" aria-label="Confirmation">
        <p class="text-sm">{{ confirming === 'erase' ? ERASE_TEXT : DISABLE_TEXT }}</p>
        <template v-if="pending.length">
          <p class="text-sm font-medium">
            {{ refused ? 'Ces modifications n’ont pas pu partir :' : `${pending.length} modification(s) faite(s) sans réseau n’ont pas encore été envoyée(s) :` }}
          </p>
          <ul class="list-disc pl-5 text-sm">
            <li v-for="operation in pending" :key="operation.id">{{ operation.element }} : {{ operation.action }}</li>
          </ul>
          <p v-if="refused" class="text-sm text-gray-500">Vous pouvez renoncer pour les régler d’abord dans le panneau des modifications.</p>
        </template>
        <div class="flex flex-wrap gap-2">
          <UButton v-if="pending.length && !refused && canSend" color="primary" :loading="busy" @click="sendThenFinish">
            Les envoyer d’abord
          </UButton>
          <UButton :color="pending.length ? 'error' : 'primary'" :variant="pending.length ? 'soft' : 'solid'" :loading="busy && !sending" :disabled="sending" @click="finish">
            {{ finishLabel }}
          </UButton>
          <UButton color="neutral" variant="ghost" :disabled="busy" @click="cancel">Annuler</UButton>
        </div>
      </div>

      <UAlert v-if="message" :color="message.color" variant="soft" :description="message.text" />
    </div>
  </UCard>
</template>

<script setup lang="ts">
import { isOfflineMode } from '~/utils/connection'
import { isOfflineDisabled, setOfflineDisabled, type OfflineStorageSize } from '~/utils/offlineDevice'
import { getOfflineQueue, notifyQueueChanged, operationSummary, processOfflineQueue } from '~/utils/offlineSync'
import { clearDeviceData, disableOfflineOnDevice, measureOfflineData } from '~/utils/storage'

type Intent = 'erase' | 'disable'
type PendingOperation = { id: string, element: string, action: string }

const ERASE_TEXT = 'Effacer ce que cet appareil garde ? Vous restez connecté·e.'
const DISABLE_TEXT = 'Désactiver le hors ligne ? Tout ce que l’appareil garde sera effacé, et Limbus ne s’ouvrira plus sans réseau sur cet appareil.'

const disabled = ref(false)
const size = ref<OfflineStorageSize | null>(null)
const confirming = ref<Intent | null>(null)
const pending = ref<PendingOperation[]>([])
const refused = ref(false)
const busy = ref(false)
const sending = ref(false)
const canSend = ref(false)
const message = ref<{ color: 'success' | 'error', text: string } | null>(null)

const finishLabel = computed(() => {
  const verb = confirming.value === 'disable' ? 'désactiver' : 'effacer'
  if (pending.value.length) return `Les abandonner et ${verb}`
  return confirming.value === 'disable' ? 'Désactiver' : 'Effacer'
})

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024).toLocaleString('fr-FR')} Ko`
  return `${(bytes / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`
}

async function measure() {
  size.value = await measureOfflineData()
}

async function readPending() {
  const queue = await getOfflineQueue()
  pending.value = queue.map((operation) => ({ id: operation.id, ...operationSummary(operation) }))
}

async function start(intent: Intent) {
  message.value = null
  refused.value = false
  canSend.value = !isOfflineMode()
  await readPending()
  confirming.value = intent
}

function cancel() {
  confirming.value = null
  pending.value = []
  refused.value = false
}

// Envoi d'abord (R4) : si des modifications restent (refus, conflit), on s'arrête et on le dit
async function sendThenFinish() {
  busy.value = true
  sending.value = true
  try {
    await processOfflineQueue()
    await readPending()
  } finally {
    busy.value = false
    sending.value = false
  }
  if (pending.value.length) {
    refused.value = true
    return
  }
  await finish()
}

async function finish() {
  const intent = confirming.value
  if (!intent) return
  busy.value = true
  try {
    // La base effacée emporte la file : les modifications en attente sont abandonnées avec elle
    if (intent === 'disable') {
      await disableOfflineOnDevice()
      // L'application retirée contrôle encore la page jusqu'à son rechargement, et garderait PDF et photos
      rememberMessage(DISABLED_MESSAGE)
      window.location.reload()
      return
    }
    await clearDeviceData()
    disabled.value = isOfflineDisabled()
    notifyQueueChanged()
    window.dispatchEvent(new CustomEvent('limbus:offline-setting'))
    message.value = { color: 'success', text: 'Les données de l’appareil sont effacées.' }
    cancel()
  } catch {
    message.value = { color: 'error', text: 'Impossible d’effacer les données de l’appareil. Réessayez.' }
  } finally {
    busy.value = false
  }
  await measure()
}

// Recocher : les pages consultées sont de nouveau gardées, et l'application se réinscrit sur l'appareil (R7)
async function enable() {
  setOfflineDisabled(false)
  disabled.value = false
  useNuxtApp().$limbusPwa.register()
  window.dispatchEvent(new CustomEvent('limbus:offline-setting'))
  message.value = { color: 'success', text: 'Le hors ligne est de nouveau actif : les pages consultées sont gardées sur cet appareil.' }
  await measure()
}

// Message gardé le temps du rechargement qui suit la désactivation
const MESSAGE_KEY = 'limbusOfflineMessage'
const DISABLED_MESSAGE = 'Le hors ligne est désactivé sur cet appareil.'

function rememberMessage(text: string) {
  try {
    sessionStorage.setItem(MESSAGE_KEY, text)
  } catch {
    // Sans stockage de session, la page rechargée montre seulement la case décochée
  }
}

function takeMessage() {
  try {
    const text = sessionStorage.getItem(MESSAGE_KEY)
    sessionStorage.removeItem(MESSAGE_KEY)
    return text
  } catch {
    return null
  }
}

onMounted(async () => {
  disabled.value = isOfflineDisabled()
  const remembered = takeMessage()
  if (remembered) message.value = { color: 'success', text: remembered }
  await measure()
})
</script>
