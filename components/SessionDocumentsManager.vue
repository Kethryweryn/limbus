<template>
  <UCard>
    <template #header>
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 class="font-semibold">Documents de session</h2>
          <p class="text-sm text-gray-500">{{ documents.length }} document(s)</p>
        </div>
      </div>
    </template>

    <div class="space-y-6">
      <SessionDocumentList />
      <SessionCharacterSheets />

      <section v-if="sessionRoleRecipients.length">
        <h3 class="font-semibold mb-3">Équipe de session</h3>
        <div class="flex flex-wrap gap-2">
          <UBadge
            v-for="recipient in sessionRoleRecipients"
            :key="`${recipient.role}-${recipient.participant.id}`"
            color="neutral"
            variant="subtle"
          >
            {{ roleLabel(recipient.role) }} - {{ recipient.participant.name }}
          </UBadge>
        </div>
      </section>

      <p v-if="serverError" class="text-red-500 text-sm">{{ serverError }}</p>
    </div>

    <EmailTestModal
      v-model:open="showTestModal"
      :default-email="props.defaultEmail"
      :organizer-emails="organizerEmails"
      :preview="testPreview"
      :on-submit="sendTestEmail"
    />
  </UCard>
</template>

<script setup lang="ts">
import { SESSION_ROLE_LABELS } from '~/utils/domain'
import { provideSessionDocumentActions, type SessionDocumentsData } from '~/composables/useSessionDocumentActions'

// Onglet Documents d'une session : documents ciblés, fiches et trombinoscopes, équipe (US-116 : sections découpées,
// état et actions partagés par provideSessionDocumentActions)
const props = withDefaults(defineProps<{
  documentsData: SessionDocumentsData
  defaultEmail?: string
  onRefresh: () => Promise<unknown>
}>(), { defaultEmail: '' })

const { documents, sessionRoleRecipients, organizerEmails, serverError, showTestModal, testPreview, sendTestEmail } =
  provideSessionDocumentActions(() => props.documentsData, () => props.onRefresh())

const roleLabel = (role: string) => role in SESSION_ROLE_LABELS ? SESSION_ROLE_LABELS[role as keyof typeof SESSION_ROLE_LABELS] : 'Session'
</script>
