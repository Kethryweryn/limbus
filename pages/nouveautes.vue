<template>
  <LegalPage title="Nouveautés" undated>
    <article v-for="note in notes" :key="`${note.at}-${note.titre}`" class="space-y-1">
      <p class="text-xs text-gray-500">
        {{ formatLongDate(note.at, 'Europe/Paris') }} · {{ RELEASE_NOTE_TYPE_LABELS[note.type] }}
      </p>
      <h2>{{ note.titre }}</h2>
      <p>{{ note.texte }}</p>
    </article>
    <!-- Pour signaler un problème (US-148) -->
    <p v-if="deployNumber" class="text-xs text-gray-400">Déploiement n° {{ deployNumber }}</p>
  </LegalPage>
</template>

<script setup lang="ts">
import releaseNotes from '#build/release-notes.json'
import { formatLongDate } from '~/utils/dates'
import { RELEASE_NOTE_TYPE_LABELS, type ReleaseNotesData } from '~/utils/releaseNotes'

// Nouveautés (US-147), lisibles sans compte
const { notes, deployNumber } = releaseNotes as ReleaseNotesData

useHead({ title: 'Nouveautés – Limbus' })
</script>
