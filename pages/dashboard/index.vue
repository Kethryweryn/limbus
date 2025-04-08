<template>
  <div class="space-y-6">
    <h1 class="text-3xl font-bold">Tableau de bord</h1>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      <!-- Widget 1 -->
      <UCard class="shadow">
        <template #header>
          <div class="flex justify-between items-center">
            <span class="font-semibold">Nombre de jeux</span>
            <UIcon name="i-heroicons-cube" />
          </div>
        </template>
        <div class="text-4xl font-bold">{{ stats.games }}</div>
        <template #footer>
          <span class="text-sm text-gray-500">Mis à jour il y a 5 min</span>
        </template>
      </UCard>

      <!-- Widget 2 -->
      <UCard class="shadow">
        <template #header>
          <div class="flex justify-between items-center">
            <span class="font-semibold">Organisateurs</span>
            <UIcon name="i-heroicons-user-group" />
          </div>
        </template>
        <div class="text-4xl font-bold">{{ stats.organizers }}</div>
        <template #footer>
          <span class="text-sm text-gray-500">Actifs ce mois-ci</span>
        </template>
      </UCard>

      <!-- Widget 3 -->
      <UCard class="shadow">
        <template #header>
          <div class="flex justify-between items-center">
            <span class="font-semibold">Prochaine session</span>
            <UIcon name="i-heroicons-calendar-days" />
          </div>
        </template>
        <div class="text-lg">{{ stats.nextSession }}</div>
        <template #footer>
          <UButton size="xs" color="gray" variant="soft">Voir les sessions</UButton>
        </template>
      </UCard>
    </div>

    <!-- Section plus détaillée (ex : activité récente) -->
    <UCard class="shadow mt-10">
      <template #header>
        <span class="font-semibold text-lg">Activité récente</span>
      </template>
      <ul class="divide-y divide-gray-200">
        <li v-for="(entry, i) in activity" :key="i" class="py-2">
          <span class="font-medium">{{ entry.user }}</span> a modifié <span class="italic">{{ entry.game }}</span>
          <span class="text-sm text-gray-500">({{ entry.date }})</span>
        </li>
      </ul>
    </UCard>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const stats = ref({
  games: 0,
  organizers: 0,
  nextSession: 'Chargement...'
})

const activity = ref([])

onMounted(async () => {
  const data = await $fetch('/api/dashboard')
  stats.value = data.stats
  activity.value = data.activity
})
</script>