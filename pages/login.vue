<template>
  <div class="flex items-center justify-center min-h-screen bg-gray-50 p-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <h1 class="text-xl font-bold">Connexion</h1>
      </template>

      <form @submit.prevent="onSubmit" class="space-y-4">
        <UInput
          v-model="email"
          type="email"
          label="Adresse e-mail"
          placeholder="exemple@limbus.gn"
          required
        />
        <UInput
          v-model="password"
          type="password"
          label="Mot de passe"
          placeholder="••••••••"
          required
        />
        <UButton type="submit" color="primary" block>
          Se connecter
        </UButton>
      </form>

      <template #footer>
        <p v-if="loginMessage" class="text-sm text-center text-red-600 mt-2">
          {{ loginMessage }}
        </p>
      </template>
    </UCard>
  </div>
</template>

<script setup>
const email = ref('');
const password = ref('');
const loginMessage = ref('');

const onSubmit = async () => {
  try {
    const res = await $fetch('/api/auth/login', {
      method: 'POST',
      body: {
        email: email.value,
        password: password.value,
      },
    });

    if (res.success) {
      loginMessage.value = `Bienvenue, rôle : ${res.role}`;
      // ici tu pourras stocker le token dans un cookie ou un store plus tard
    } else {
      loginMessage.value = res.message || 'Erreur inconnue';
    }
  } catch (err) {
    console.error(err);
    loginMessage.value = 'Erreur serveur';
  }
};
</script>
