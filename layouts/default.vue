<!-- layouts/default.vue -->
<template>
    <div class="min-h-screen bg-gray-50 text-gray-900">
        <!-- Header -->
        <header class="flex items-center justify-between p-4 bg-white shadow-md">
            <div class="flex items-center space-x-2">
                <UButton icon="i-heroicons-bars-3" color="gray" variant="ghost" class="md:hidden"
                    @click="mobileOpen = true" />
                <span class="font-bold text-xl ml-2">Limbus</span>
            </div>
            <UDropdown :items="userMenu" :popper="{ placement: 'bottom-end' }">
                <UAvatar size="sm" icon="i-heroicons-user" />
            </UDropdown>
        </header>

        <!-- Layout -->
        <div class="flex">
            <!-- Sidebar desktop -->
            <aside class="hidden md:block w-64 bg-white border-r p-4">
                <UVerticalNavigation :links="navLinks" />
            </aside>

            <!-- Page content -->
            <main class="flex-1 p-6">
                <slot />
                <ClientOnly>
                    <div v-if="$pwa?.needRefresh" class="pwa-toast" role="alert" aria-labelledby="toast-message">
                        <div class="message">
                            <span id="toast-message">
                                New content available, click on reload button to update
                            </span>
                        </div>
                        <div class="buttons">
                            <button @click="$pwa.updateServiceWorker()">
                                Reload
                            </button>
                            <button @click="$pwa.cancelPrompt()">
                                Close
                            </button>
                        </div>
                    </div>
                </ClientOnly>
            </main>
        </div>

        <!-- Mobile Sidebar -->
        <USlideover v-model="mobileOpen">
            <div class="p-4 space-y-6">
                <h2 class="text-lg font-bold">Navigation</h2>
                <UVerticalNavigation :links="navLinks" @click="mobileOpen = false" />
            </div>
        </USlideover>
    </div>
</template>

<script setup>
import { navigateTo } from '#app'

const navLinks = [
    { label: 'Dashboard', to: '/', icon: 'i-heroicons-home' },
    { label: 'Jeux', to: '/games', icon: 'i-heroicons-cube' },
    { label: 'Personnages', to: '/characters', icon: 'i-heroicons-identification' }
]

const userMenu = [
    [
        {
            label: 'Déconnexion',
            icon: 'i-heroicons-arrow-left-on-rectangle',
            click: () => navigateTo('/logout')
        }
    ]
]
</script>


<style>
.pwa-toast {
    position: fixed;
    right: 0;
    bottom: 0;
    margin: 16px;
    padding: 12px;
    border: 1px solid #8885;
    border-radius: 4px;
    z-index: 1;
    text-align: left;
    box-shadow: 3px 4px 5px 0 #8885;
    background-color: white;
}

.pwa-toast .message {
    margin-bottom: 8px;
}

.pwa-toast button {
    border: 1px solid #8885;
    outline: none;
    margin-right: 5px;
    border-radius: 2px;
    padding: 3px 10px;
}
</style>