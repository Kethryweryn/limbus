<template>
  <div class="p-6 max-w-3xl space-y-4">
    <UButton to="/participer" color="neutral" variant="ghost" icon="i-heroicons-arrow-left" size="sm">Je participe</UButton>

    <UAlert v-if="loadError" color="error" variant="soft" :description="loadError" />
    <p v-else-if="pending" class="text-sm text-gray-500">Chargement…</p>

    <template v-else-if="delivery">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold">{{ delivery.title }}</h1>
          <p class="text-sm text-gray-500">
            {{ delivery.session.gameTitle }} · {{ delivery.session.name }} · reçu le {{ formatDate(delivery.sentAt) }}
          </p>
        </div>
        <UButton
          v-if="delivery.source"
          :to="`/api/me/documents/${delivery.id}/pdf`"
          target="_blank"
          external
          color="neutral"
          variant="soft"
          icon="i-heroicons-document-arrow-down"
        >
          PDF
        </UButton>
      </div>

      <UAlert
        v-if="delivery.source === 'current'"
        color="neutral"
        variant="soft"
        description="Version actuelle du document : elle peut avoir changé depuis l’email que vous avez reçu."
      />
      <UAlert
        v-else-if="!delivery.source"
        color="warning"
        variant="soft"
        description="Ce document n’est plus disponible ici : retrouvez-le en pièce jointe de l’email reçu."
      />

      <UCard v-if="delivery.text">
        <p v-if="delivery.text.subtitle" class="text-sm text-gray-500 mb-4">{{ delivery.text.subtitle }}</p>
        <div class="space-y-4">
          <section v-for="(section, index) in delivery.text.sections" :key="index">
            <h2 v-if="section.title" class="font-semibold">{{ section.title }}</h2>
            <p class="whitespace-pre-line text-sm">{{ section.body || '—' }}</p>
          </section>
        </div>
      </UCard>

      <div v-if="delivery.cards" class="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div v-for="(card, index) in delivery.cards" :key="index" class="rounded border border-gray-200 p-3 text-center space-y-2">
          <img v-if="card.photoUrl" :src="card.photoUrl" alt="" class="mx-auto aspect-[3/4] w-full rounded object-cover">
          <div v-else class="flex aspect-[3/4] w-full items-center justify-center rounded bg-gray-100 text-3xl text-gray-400">?</div>
          <div class="font-medium">{{ card.displayName }}</div>
          <div v-if="card.tags.length" class="flex flex-wrap justify-center gap-1">
            <UBadge v-for="tag in card.tags" :key="tag" color="neutral" variant="subtle" size="sm">{{ tag }}</UBadge>
          </div>
          <p v-if="card.note" class="text-xs text-gray-600 whitespace-pre-line">{{ card.note }}</p>
        </div>
      </div>
      <p v-else-if="delivery.kind === 'trombinoscope' && delivery.source" class="text-sm text-gray-500">
        Ce trombinoscope se lit en PDF.
      </p>
    </template>
  </div>
</template>

<script setup>
// Un document reçu, dans « Je participe » (US-079)
const route = useRoute()
const delivery = ref(null)
const pending = ref(true)
const loadError = ref('')

onMounted(async () => {
  try {
    delivery.value = await useApiFetch(`/api/me/documents/${encodeURIComponent(String(route.params.id || ''))}`, { offlineCache: true })
  } catch (err) {
    loadError.value = err?.data?.message || 'Impossible de charger ce document.'
  } finally {
    pending.value = false
  }
})

const formatDate = (value) => new Date(value).toLocaleDateString('fr-FR', { dateStyle: 'long' })
</script>
