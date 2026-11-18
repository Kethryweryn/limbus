<template>
  <!-- Tout en haut de la page, comme les bandeaux de connexion : il pousse la page et défile avec elle (US-256).
       La zone annoncée aux lecteurs d'écran est toujours présente, vide sans version qui attend : son texte, qui
       apparaît ensuite, est lu -->
  <div role="status" aria-label="Nouvelle version">
    <div v-if="shown" class="flex flex-wrap items-center justify-between gap-2 border-b border-primary-200 bg-primary-50 px-4 py-2 text-sm text-primary-900">
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
import { useConnectionRefresh } from '~/composables/useOfflineList'
import { applyUpdate } from '~/utils/pwaUpdate'

// Nouvelle version proposée, jamais chargée d'elle-même (US-254, ADR-0093) ; masquée sans réseau ou serveur
// indisponible, car la page rechargée ne pourrait pas être servie
const pwa = useNuxtApp().$limbusPwa
const { isOffline } = useConnectionRefresh(() => {})

const shown = computed(() => Boolean(pwa?.needRefresh && !pwa.dismissed && !isOffline.value))

function reload() {
  applyUpdate(pwa, { reload: () => window.location.reload(), setTimeout: (callback, delay) => window.setTimeout(callback, delay) })
}

function dismiss() {
  pwa.dismissed = true
}
</script>
