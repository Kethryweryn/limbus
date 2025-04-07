<template>
  <div class="flex items-center justify-center min-h-screen p-4 bg-gray-100">
    <UCard class="w-full max-w-lg text-center">
      <template #header>
        <h1 class="text-2xl font-bold">Bienvenue sur Limbus</h1>
      </template>
      <p class="text-gray-700">Ceci est la page d'accueil temporaire.</p>
      <template #footer>
        <NuxtLink to="/login">
          <UButton class="mt-4" color="primary">Se connecter</UButton>
        </NuxtLink>
      </template>
    </UCard>
  </div>
</template>