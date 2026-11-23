// Types de virtual:pwa-register : fournis par @unplugin-pwa/core, qui vient avec @vite-pwa/nuxt 2 et que Limbus ne
// déclare pas lui-même, pour rester sur la version que le module utilise. Si le module change de paquet, le typage
// de la CI le signale
/// <reference types="@unplugin-pwa/core/vanillajs" />
import { registerSW } from 'virtual:pwa-register'
import { reactive } from 'vue'
import { isOfflineDisabled } from '~/utils/offlineDevice'
import type { PwaUpdate, UpdateRegistration } from '~/utils/pwaUpdate'

// Inscription de l'application sur l'appareil, à la place de celle du module @vite-pwa/nuxt (client.registerPlugin :
// false) : un appareil où le hors ligne est désactivé ne la reçoit pas (SPEC-019, R5 ; ADR-0081). La réactiver
// l'inscrit aussitôt, sans recharger la page
export type LimbusPwa = PwaUpdate & { register: () => void }

export default defineNuxtPlugin(() => {
  let registration: UpdateRegistration | undefined
  let update: () => Promise<void> = async () => {}
  let registered = false

  const pwa: LimbusPwa = reactive({
    needRefresh: false,
    dismissed: false,
    applying: false,
    updateServiceWorker: () => update(),
    getSWRegistration: () => registration,
    register: () => {
      if (registered || !('serviceWorker' in navigator)) return
      registered = true
      update = registerSW({
        immediate: true,
        // Une version (ou une plus récente) attend : le bandeau la propose, même s'il avait été fermé
        onNeedRefresh: () => {
          pwa.needRefresh = true
          pwa.dismissed = false
        },
        // La nouvelle version a pris la main. Sans ce rappel, le module rechargerait l'onglet, même quand un autre
        // onglet l'a activée : seul « Recharger » choisi ici recharge (US-254, ADR-0093)
        onNeedReload: () => {
          if (pwa.applying) window.location.reload()
        },
        onRegisteredSW: (_url, swRegistration) => { registration = swRegistration }
      })
    }
  })

  if (!isOfflineDisabled()) pwa.register()

  return { provide: { limbusPwa: pwa } }
})
