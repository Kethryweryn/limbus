<template>
  <div class="flex items-center justify-center min-h-screen bg-gray-100 p-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <h1 class="text-xl font-bold">Test Login (sans API)</h1>
      </template>

      <form @submit.prevent="onSubmit" class="space-y-4">
        <UInput v-model="email" type="email" label="Adresse e-mail" placeholder="exemple@limbus.gn" />
        <UInput v-model="password" type="password" label="Mot de passe" placeholder="••••••••" />
        <UButton type="submit" block>Envoyer</UButton>
      </form>

      <template #footer>
        <p v-if="message" class="text-sm text-green-600 mt-4 text-center">
          {{ message }}
        </p>
      </template>
    </UCard>
  </div>
</template>

<script setup>
const email = ref('');
const password = ref('');
const message = ref('');

const onSubmit = async () => {
  try {
    const res = await $fetch('/api/auth/login', {
      method: 'POST',
      body: {
        email: email.value,
        password: password.value
      }
    });

    if (res.success) {
      message.value = `Bienvenue !`;
    } else {
      message.value = res.message;
    }
  } catch (err) {
    console.error('Erreur API', err);
    message.value = 'Erreur serveur';
  }
};

</script>