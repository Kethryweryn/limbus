<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 class="text-lg font-semibold">{{ gameTitle }}</h2>
          <p class="text-sm text-gray-500">
            {{ periods.length }} période{{ periods.length > 1 ? 's' : '' }} d’inscription
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton icon="i-heroicons-clipboard-document-list" color="neutral" variant="soft" @click="showFormEditor = true">
            Formulaire
          </UButton>
          <UButton icon="i-heroicons-plus" color="primary" @click="edit(null)">
            Nouvelle période d’inscription
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
        Aucune période d’inscription pour ce jeu.
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
      :period="inviteTarget.period"
      :link="inviteTarget.link"
      @invited="invited"
    />
    <RegistrationDetail v-model:open="showDetailModal" :registration-id="detailId" @changed="refresh" />
    <RegistrationExtensionModal />
  </UCard>
</template>

<script setup lang="ts">
import { provideRegistrationPeriodActions, type RegistrationPeriod } from '~/composables/useRegistrationPeriodActions'

// Bloc d'un jeu sur la page Inscriptions (R33) : ses périodes d'inscription et son formulaire (US-002). Découpé
// en sections (US-117) qui partagent l'état et les actions du bloc.
const props = withDefaults(defineProps<{
  gameId: string
  gameTitle: string
  // Périodes déjà chargées par la page, avec leurs inscriptions
  initialPeriods?: RegistrationPeriod[] | null
}>(), { initialPeriods: null })

const {
  periods, errorMessage, infoMessage, infoColor, refresh,
  showDetailModal, detailId, showInviteForm, inviteTarget, invited, showForm, editedPeriod, edit
} = provideRegistrationPeriodActions(() => props.gameId)
const showFormEditor = ref(false)

if (props.initialPeriods) periods.value = props.initialPeriods
else await refresh()
</script>
