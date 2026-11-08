<template>
  <!-- Mot de passe qu'on peut afficher pendant la saisie (US-180) ; les autres attributs vont au champ -->
  <UInput v-model="model" :type="visible ? 'text' : 'password'" :ui="{ trailing: 'pe-1' }">
    <template #trailing>
      <UButton
        color="neutral"
        variant="link"
        size="sm"
        :icon="visible ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
        :aria-label="visible ? 'Masquer les caractères' : 'Afficher les caractères'"
        :aria-pressed="visible"
        @click="visible = !visible"
      />
    </template>
  </UInput>
</template>

<script setup lang="ts">
const model = defineModel<string>({ default: '' })
const visible = ref(false)
</script>
