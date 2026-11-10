<template>
  <!-- Prolongation de l'échéance d'une inscription (R20 ; US-117, découpé de RegistrationPeriodsPanel) -->
  <UModal v-model:open="showExtension" :title="extensionTarget ? `Prolonger l’échéance de ${extensionTarget.participant.name}` : 'Prolonger'">
    <template #body>
      <form class="space-y-4" novalidate @submit.prevent="extend">
        <UFormField
          label="Nouvelle échéance"
          description="La personne peut répondre jusqu’à la fin de ce jour."
          :error="extensionError || undefined"
        >
          <UInput v-model="extensionDate" type="date" :min="isoDate(new Date())" :max="maxExtension()" required />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="soft" @click="showExtension = false">Annuler</UButton>
          <UButton type="submit" color="primary" :loading="extending">Prolonger</UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { isoDate, useRegistrationPeriodActions } from '~/composables/useRegistrationPeriodActions'

const { showExtension, extensionTarget, extensionDate, extensionError, extending, extend } = useRegistrationPeriodActions()

// Le serveur refuse une échéance à plus d'un an (R20)
const maxExtension = () => isoDate(new Date(Date.now() + 364 * 24 * 60 * 60 * 1000))
</script>
