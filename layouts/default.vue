<template>
    <div class="min-h-screen bg-gray-50 text-gray-900">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b shadow-md bg-white">
            <div class="flex items-center space-x-2">
                <UButton icon="i-heroicons-bars-3" color="gray" variant="ghost" class="md:hidden"
                    @click="mobileOpen = true" />
                <span class="font-bold text-xl">Limbus</span>
            </div>

            <UDropdown :items="userMenu" :popper="{ placement: 'bottom-end' }">
                <UButton variant="ghost" icon="i-heroicons-user" />
            </UDropdown>
        </div>

        <!-- Layout -->
        <div class="flex">
            <!-- Sidebar desktop -->
            <aside class="hidden md:block w-64 bg-white border-r p-4">
                <UNavigationTree :links="navLinks" />
            </aside>

            <!-- Page content -->
            <main class="flex-1 p-6">
                <slot />
            </main>
        </div>

        <!-- Mobile Sidebar -->
        <USlideover v-model:open="mobileOpen">
            <div class="p-4 space-y-6">
                <h2 class="text-lg font-bold">Navigation</h2>
                <UNavigationTree :links="navLinks" @select="mobileOpen = false" />
            </div>
        </USlideover>
    </div>
</template>

<script setup>
import { ref } from 'vue'
import { navigateTo } from '#app'

const mobileOpen = ref(false)

const navLinks = [
    { label: 'Dashboard', to: '/dashboard', icon: 'i-heroicons-home' },
    { label: 'Jeux', to: '/dashboard/games', icon: 'i-heroicons-cube' }
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