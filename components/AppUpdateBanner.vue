<template>
  <!-- Place réservée sous la page : le bandeau, fixé en bas de l'écran, ne masque rien (US-254) -->
  <div v-if="shown" class="h-20 sm:h-14" aria-hidden="true" />
  <div
    v-if="shown"
    role="status"
    aria-label="Nouvelle version"
    class="fixed inset-x-0 bottom-0 z-40 h-20 border-t border-primary-200 bg-primary-50 px-4 py-2 text-sm text-primary-900 shadow-md sm:h-14"
  >
    <div class="mx-auto flex h-full max-w-5xl flex-wrap items-center justify-between gap-2">
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

// Les toasts, en bas de l'écran eux aussi, passent au-dessus du bandeau
useHead({ htmlAttrs: { class: computed(() => shown.value ? 'update-banner-shown' : '') } })

function reload() {
  applyUpdate(pwa, { reload: () => window.location.reload(), setTimeout: (callback, delay) => window.setTimeout(callback, delay) })
}

function dismiss() {
  pwa.dismissed = true
}
</script>

<style>
html.update-banner-shown .limbus-toaster {
  bottom: 6rem;
}

@media (min-width: 640px) {
  html.update-banner-shown .limbus-toaster {
    bottom: 4.5rem;
  }
}
</style>
