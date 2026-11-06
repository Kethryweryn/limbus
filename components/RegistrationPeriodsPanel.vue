<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 class="text-lg font-semibold">{{ gameTitle }}</h2>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton icon="i-heroicons-clipboard-document-list" color="neutral" variant="soft" @click="showFormEditor = true">
            Formulaire
          </UButton>
          <UButton v-if="!periods.length" icon="i-heroicons-plus" color="primary" @click="edit(null)">
            Créer le vivier
          </UButton>
        </div>
      </div>
    </template>

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="soft"
      class="mb-4"
      :description="errorMessage"
    />
    <UAlert
      v-if="infoMessage"
      :color="infoColor"
      variant="soft"
      class="mb-4"
      :description="infoMessage"
      :close="{ color: 'neutral', variant: 'link' }"
      @update:open="infoMessage = ''"
    />

    <div class="space-y-3">
      <RegistrationPeriodCard v-for="period in periods" :key="period.id" :period="period" />

      <p v-if="!periods.length" class="text-sm text-gray-500">
        Ce jeu n’a pas encore de vivier.
      </p>
    </div>

    <RegistrationPeriodForm
      v-model:open="showForm"
      :game-id="gameId"
      :period="editedPeriod"
      @saved="refresh"
    />
    <RegistrationFormEditor v-model:open="showFormEditor" :game-id="gameId" :game-title="gameTitle" />
    <RegistrationInviteForm
      v-if="inviteTarget"
      v-model:open="showInviteForm"
      :game-id="gameId"
      :period="inviteTarget"
      @invited="invited"
    />
    <RegistrationDetail v-model:open="showDetailModal" :registration-id="detailId" @changed="refresh" />
    <RegistrationExtensionModal />
  </UCard>
</template>

<script setup lang="ts">
import { provideRegistrationPeriodActions, type RegistrationPeriod } from '~/composables/useRegistrationPeriodActions'

// Bloc d'un jeu sur la page Inscriptions : son vivier et son formulaire (SPEC-018). Découpé en sections (US-117) qui
// partagent l'état et les actions du bloc.
const props = defineProps<{
  gameId: string
  gameTitle: string
  // Vivier lu par la page, avec ses personnes ; une nouvelle lecture (changement de connexion, US-119) le remplace
  initialPeriods: RegistrationPeriod[]
}>()

const {
  periods, errorMessage, infoMessage, infoColor, refresh,
  showDetailModal, detailId, showInviteForm, inviteTarget, invited, showForm, editedPeriod, edit
} = provideRegistrationPeriodActions(() => props.gameId)
const showFormEditor = ref(false)

watch(() => props.initialPeriods, (initial) => {
  periods.value = initial
}, { immediate: true })
</script>
