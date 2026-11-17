<template>
  <!-- Place réservée sous la page : le bandeau, fixé en bas de l'écran, ne masque rien (US-254) -->
  <div v-if="shown" class="h-20 sm:h-14" aria-hidden="true" />
  <div
    v-if="shown"
    role="region"
    aria-label="Nouvelle version"
    class="fixed inset-x-0 bottom-0 z-40 border-t border-primary-200 bg-primary-50 px-4 py-2 text-sm text-primary-900 shadow-md"
  >
    <div class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
      <span>Une nouvelle version de Limbus est disponible.</span>
      <div class="flex items-center gap-1">
        <UButton size="xs" color="primary" @click="reload">
          Recharger
        </UButton>
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-heroicons-x-mark"
          aria-label="Fermer"
          @click="dismiss"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { isOfflineMode } from '~/utils/connection'
import { applyUpdate } from '~/utils/pwaUpdate'

// Nouvelle version proposée, jamais chargée d'elle-même (US-254, ADR-0093) ; masquée sans réseau ou serveur
// indisponible, car la page rechargée ne pourrait pas être servie
const pwa = useNuxtApp().$limbusPwa
const reachable = ref(false)
const readConnection = () => { reachable.value = !isOfflineMode() }

const shown = computed(() => Boolean(pwa?.needRefresh && !pwa.dismissed && reachable.value))

function reload() {
  applyUpdate(pwa, { reload: () => window.location.reload(), setTimeout: (callback, delay) => window.setTimeout(callback, delay) })
}

function dismiss() {
  pwa.dismissed = true
}

onMounted(() => {
  readConnection()
  window.addEventListener('online', readConnection)
  window.addEventListener('offline', readConnection)
  window.addEventListener('limbus:connection-change', readConnection)
})

onUnmounted(() => {
  window.removeEventListener('online', readConnection)
  window.removeEventListener('offline', readConnection)
  window.removeEventListener('limbus:connection-change', readConnection)
})
</script>
