<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">
      Tableau de bord <span v-if="user">({{ user.role }})</span>
    </h1>
    <UButton color="red" @click="logout">Se déconnecter</UButton>
  </div>
</template>

<script setup>
const user = useRequestEvent()?.context.authUser

const logout = async () => {
  await $fetch('/api/auth/logout', { method: 'POST' })
  return navigateTo('/login')
}
</script>