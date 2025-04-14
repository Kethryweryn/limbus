<script setup lang="ts">
const email = ref('')
const password = ref('')
const error = ref('')

const login = async () => {
    try {
        await $fetch('/api/auth/login', {
            method: 'POST',
            body: { email: email.value, password: password.value }
        })

        if (window.location.pathname === '/logout') {
            window.location.href = '/';
        } else {
            window.location.reload();
        }
    } catch (err: any) {
        error.value = err?.data?.message || 'Erreur de connexion'
    }
}
</script>

<template>
    <div class="min-h-screen flex flex-col items-center justify-center">
        <h1 class="text-2xl mb-4">Connexion</h1>
        <form @submit.prevent="login" class="space-y-2">
            <input v-model="email" type="email" placeholder="Email" required />
            <input v-model="password" type="password" placeholder="Mot de passe" required />
            <button type="submit">Se connecter</button>
            <p v-if="error" class="text-red-600">{{ error }}</p>
        </form>
    </div>
</template>