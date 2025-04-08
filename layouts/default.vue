<!-- layouts/default.vue -->
<template>
    <div class="min-h-screen bg-gray-50 text-gray-900">
        <!-- Header -->
        <UHeader class="shadow-md">
            <template #logo>
                <UButton icon="i-heroicons-bars-3" color="gray" variant="ghost" class="md:hidden"
                    @click="mobileOpen = true" />
                <span class="font-bold text-xl ml-2">Limbus</span>
            </template>

            <template #actions>
                <UDropdown :items="userMenu" :popper="{ placement: 'bottom-end' }">
                    <UAvatar size="sm" icon="i-heroicons-user" />
                </UDropdown>
            </template>
        </UHeader>

        <!-- Layout -->
        <div class="flex">
            <!-- Sidebar desktop -->
            <aside class="hidden md:block w-64 bg-white border-r p-4">
                <UVerticalNavigation :links="navLinks" />
            </aside>

            <!-- Page content -->
            <main class="flex-1 p-6">
                <slot />
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