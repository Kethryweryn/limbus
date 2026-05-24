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
    <div class="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 flex items-center justify-center">
        <UCard class="w-full max-w-md">
            <template #header>
                <div class="space-y-4">
                    <img
                        src="/brand/limbus-logo-header.png"
                        alt="Limbus"
                        class="mx-auto h-28 w-full max-w-xs object-contain"
                    >
                    <h1 class="text-2xl font-semibold">Connexion</h1>
                    <p class="text-sm text-gray-500">Accédez à votre espace Limbus.</p>
                </div>
            </template>

            <div v-if="isOffline" class="space-y-3">
                <UAlert
                    color="warning"
                    variant="soft"
                    icon="i-heroicons-wifi"
                    :title="offlineMessage"
                    description="La connexion nécessite un accès au serveur."
                />
            </div>

            <form v-else class="space-y-4" @submit.prevent="login">
                <UFormField label="Email">
                    <UInput
                        v-model="email"
                        type="email"
                        autocomplete="email"
                        required
                        size="lg"
                        class="w-full"
                    />
                </UFormField>

                <UFormField label="Mot de passe">
                    <UInput
                        v-model="password"
                        type="password"
                        autocomplete="current-password"
                        required
                        size="lg"
                        class="w-full"
                    />
                </UFormField>

                <UButton type="submit" color="primary" size="lg" block>
                    Se connecter
                </UButton>

                <UAlert
                    v-if="error"
                    color="error"
                    variant="soft"
                    :description="error"
                />
            </form>
        </UCard>
    </div>
</template>
