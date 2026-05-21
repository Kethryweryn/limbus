<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { isOfflineMode, isServerUnavailableError, setServerUnavailable } from '~/utils/connection'

const email = ref('')
const password = ref('')
const error = ref('')
const isOffline = ref(false)
const browserOnline = ref(true)
const offlineMessage = computed(() => browserOnline.value ? 'Le serveur ne répond pas.' : 'Vous êtes hors ligne.')

const updateStatus = () => {
    browserOnline.value = navigator.onLine
    isOffline.value = isOfflineMode()
}

const login = async () => {
    try {
        await $fetch('/api/auth/login', {
            method: 'POST',
            body: { email: email.value, password: password.value }
        })

        if (window.location.pathname === '/logout') {
            window.location.href = '/'
        } else {
            window.location.reload()
        }
        setServerUnavailable(false)
    } catch (err: any) {
        if (isServerUnavailableError(err)) {
            setServerUnavailable(true)
            updateStatus()
            error.value = 'Serveur indisponible.'
            return
        }
        error.value = err?.data?.message || 'Erreur de connexion'
    }
}

onMounted(() => {
    updateStatus()
    window.addEventListener('online', updateStatus)
    window.addEventListener('offline', updateStatus)
    window.addEventListener('limbus:connection-change', updateStatus)
})

onUnmounted(() => {
    window.removeEventListener('online', updateStatus)
    window.removeEventListener('offline', updateStatus)
    window.removeEventListener('limbus:connection-change', updateStatus)
})
</script>

<template>
    <div class="min-h-screen flex flex-col items-center justify-center">
        <h1 class="text-2xl mb-4">Connexion</h1>

        <div v-if="isOffline" class="text-center text-gray-500">
            <p>{{ offlineMessage }}</p>
            <p>La connexion nécessite un accès au serveur.</p>
        </div>

        <form v-else @submit.prevent="login" class="space-y-2">
            <input v-model="email" type="email" placeholder="Email" required />
            <input v-model="password" type="password" placeholder="Mot de passe" required />
            <button type="submit">Se connecter</button>
            <p v-if="error" class="text-red-600">{{ error }}</p>
        </form>
    </div>
</template>
