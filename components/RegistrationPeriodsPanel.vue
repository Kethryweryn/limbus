<template>
  <!-- Inscriptions d'un jeu (SPEC-020) : les messages en haut (R6), puis les onglets Sessions, Vivier et Réglages (R4) -->
  <div class="space-y-4">
    <UAlert
      v-if="errorMessage"
      color="error"
      variant="soft"
      :description="errorMessage"
    />
    <UAlert
      v-if="infoMessage"
      :color="infoColor"
      variant="soft"
      :description="infoMessage"
      :close="{ color: 'neutral', variant: 'link' }"
      @update:open="infoMessage = ''"
    />

    <!-- Sans vivier, pas d'onglets : le créer, ou préparer le formulaire (R4) -->
    <div v-if="!period" class="space-y-3 rounded border border-gray-200 p-4">
      <p class="text-sm text-gray-500">Ce jeu n’a pas encore de vivier.</p>
      <div class="flex flex-wrap gap-2">
        <UButton icon="i-heroicons-plus" color="primary" @click="edit(null)">Créer le vivier</UButton>
        <UButton icon="i-heroicons-clipboard-document-list" color="neutral" variant="soft" @click="showFormEditor = true">Formulaire</UButton>
      </div>
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center gap-2 text-sm">
        <span class="font-medium">Vivier</span>
        <UBadge :color="stateMeta.color" variant="subtle">{{ stateMeta.label }}</UBadge>
      </div>

      <!-- L'onglet ouvert est dans l'adresse (R5) -->
      <UTabs v-model="tab" :items="tabs" :content="false" variant="link" class="w-full" />

      <RegistrationPeriodCard v-if="tab === 'reglages'" :period="period" @form="showFormEditor = true" />
      <RegistrationInvitationList v-if="tab === 'vivier'" :period="period" />
      <!-- Sessions et vivier partagent la même lecture de la sélection : le bloc reste monté d'un onglet à l'autre -->
      <RegistrationSelection v-show="tab !== 'reglages'" :period="period" :view="tab === 'vivier' ? 'vivier' : 'sessions'" />
    </template>

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
  </div>
</template>

<script setup lang="ts">
import { provideRegistrationPeriodActions, type RegistrationPeriod } from '~/composables/useRegistrationPeriodActions'
import { periodStateMeta, poolOf, REGISTRATION_TABS, type RegistrationTab } from '~/utils/registrations'

// Inscriptions d'un jeu (SPEC-018, SPEC-020) : ses sections partagent l'état et les actions du bloc (US-117)
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

// Un seul vivier par jeu (SPEC-018)
const period = computed(() => periods.value[0])
const stateMeta = computed(() => periodStateMeta(period.value?.state ?? ''))
const poolSize = computed(() => poolOf(period.value?.registrations ?? []).length)

const route = useRoute()
const router = useRouter()
const tab = computed<RegistrationTab>({
  get: () => REGISTRATION_TABS.find((value) => value === route.query.onglet) ?? 'sessions',
  set: (value) => { void router.replace({ query: { ...route.query, onglet: value === 'sessions' ? undefined : value } }) }
})
const tabs = computed(() => [
  { label: 'Sessions', value: 'sessions' },
  { label: `Vivier (${poolSize.value})`, value: 'vivier' },
  { label: 'Réglages', value: 'reglages' }
])
</script>
