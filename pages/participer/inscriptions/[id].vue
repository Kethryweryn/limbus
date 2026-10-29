<template>
  <div class="p-6 max-w-2xl space-y-4">
    <UButton to="/participer" color="neutral" variant="ghost" icon="i-heroicons-arrow-left" size="sm">Je participe</UButton>
    <RegistrationResponse :endpoint="`/api/me/registrations/${encodeURIComponent(String(route.params.id || ''))}`" :personal-link="false" />
  </div>
</template>

<script setup>
// Répondre à une inscription depuis le compte (US-072)
const route = useRoute()
</script>
