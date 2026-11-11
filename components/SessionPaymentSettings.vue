<template>
  <!-- Réglages des paiements de la session : date limite, lien, RIB (US-116, découpé de SessionPaymentsManager) -->
  <section class="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-end">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <UFormField label="Date limite de désistement" help="Après elle, une place n'est remboursée qu'au choix de l'organisation.">
        <UInput v-model="settings.withdrawalDeadline" type="date" />
      </UFormField>
      <UFormField label="Lien de paiement">
        <UInput v-model="settings.paymentLinkUrl" placeholder="https://..." />
      </UFormField>
      <UFormField label="RIB PDF">
        <div class="flex flex-wrap items-center gap-2">
          <input
            ref="ribInput"
            type="file"
            accept="application/pdf"
            class="hidden"
            @change="uploadRib"
          >
          <UButton
            color="neutral"
            variant="soft"
            :loading="uploadingRib"
            @click="ribInput?.click()"
          >
            {{ settings.paymentRibUrl ? 'Remplacer le RIB' : 'Téléverser un RIB' }}
          </UButton>
          <UButton
            v-if="settings.paymentRibUrl"
            color="neutral"
            variant="ghost"
            :to="settings.paymentRibUrl"
            target="_blank"
          >
            Voir le PDF
          </UButton>
          <UButton
            v-if="settings.paymentRibUrl"
            color="neutral"
            variant="ghost"
            @click="removeRib"
          >
            Retirer
          </UButton>
        </div>
      </UFormField>
    </div>
    <UButton color="primary" variant="soft" :loading="savingSettings" @click="save">
      Enregistrer
    </UButton>
  </section>
</template>

<script setup lang="ts">
import { useSessionPaymentActions } from '~/composables/useSessionPaymentActions'
import { apiErrorMessage } from '~/utils/apiErrors'

const { session, settings, serverError, saveSettings } = useSessionPaymentActions()

const savingSettings = ref(false)
const uploadingRib = ref(false)
const ribInput = ref<HTMLInputElement | null>(null)

async function save() {
  savingSettings.value = true
  try {
    return await saveSettings()
  } finally {
    savingSettings.value = false
  }
}

async function uploadRib(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  uploadingRib.value = true
  try {
    const formData = new FormData()
    formData.append('rib', file)
    formData.append('sessionId', session().id)
    const result = await useApiAction('/api/uploads/session-payment-ribs', { method: 'POST', body: formData })
    await saveRib(result.ribUrl)
  } catch (err) {
    serverError.value = apiErrorMessage(err, 'Impossible de téléverser le RIB')
  } finally {
    uploadingRib.value = false
    input.value = ''
  }
}

function removeRib() {
  return saveRib('')
}

// Le RIB affiché suit celui enregistré : un enregistrement refusé remet le précédent
async function saveRib(ribUrl: string) {
  const previous = settings.value.paymentRibUrl
  settings.value.paymentRibUrl = ribUrl
  if (!await save()) settings.value.paymentRibUrl = previous
}
</script>
