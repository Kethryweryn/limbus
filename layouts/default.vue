<!-- layouts/default.vue -->
<template>
    <div class="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
        <!-- Header -->
        <header class="flex items-center justify-between p-4 bg-white shadow-md">
            <div class="flex items-center space-x-2">
                <UButton icon="i-heroicons-bars-3" color="neutral" variant="ghost" class="md:hidden"
                    @click="mobileOpen = true" />
                <span class="font-bold text-xl ml-2">Limbus</span>
            </div>
            <UDropdownMenu :items="userMenu" :content="{ align: 'end' }">
                <UAvatar size="sm" icon="i-heroicons-user" />
            </UDropdownMenu>
        </header>

        <!-- Layout -->
        <div class="flex flex-1 min-h-0">
            <!-- Sidebar desktop -->
            <aside
                class="hidden md:flex bg-white border-r self-stretch flex-col transition-[width] duration-200"
                :class="sidebarCollapsed ? 'w-20' : 'w-64'"
            >
                <div class="flex items-center p-3 border-b border-gray-100" :class="sidebarCollapsed ? 'justify-center' : 'justify-between'">
                    <span v-if="!sidebarCollapsed" class="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Navigation
                    </span>
                    <UButton
                        :icon="sidebarCollapsed ? 'i-heroicons-chevron-double-right' : 'i-heroicons-chevron-double-left'"
                        color="neutral"
                        variant="ghost"
                        size="sm"
                        :aria-label="sidebarCollapsed ? 'Déplier le menu' : 'Replier le menu'"
                        @click="toggleSidebar"
                    />
                </div>

                <nav class="flex-1 p-3 space-y-5 overflow-y-auto">
                    <div>
                        <SidebarLink
                            :item="dashboardLink"
                            :collapsed="sidebarCollapsed"
                            :active="isActive(dashboardLink.to)"
                        />
                    </div>

                    <SidebarSection
                        v-for="section in navSections"
                        :key="section.label"
                        :section="section"
                        :collapsed="sidebarCollapsed"
                        :is-active="isActive"
                    />
                </nav>
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
        <USlideover v-model:open="mobileOpen" title="Navigation">
            <template #body>
                <div class="p-4 space-y-6">
                    <h2 class="text-lg font-bold">Navigation</h2>
                    <nav class="space-y-5">
                        <SidebarLink
                            :item="dashboardLink"
                            :active="isActive(dashboardLink.to)"
                            @click="mobileOpen = false"
                        />
                        <SidebarSection
                            v-for="section in navSections"
                            :key="section.label"
                            :section="section"
                            :is-active="isActive"
                            @navigate="mobileOpen = false"
                        />
                    </nav>
                </div>
            </template>
        </USlideover>
    </div>
</template>

<script setup>
import { navigateTo } from '#app'

const route = useRoute()
const sidebarCollapsed = ref(false)

const dashboardLink = { label: 'Dashboard', to: '/', icon: 'i-heroicons-home' }

const navSections = [
    {
        label: 'Écriture',
        icon: 'i-heroicons-pencil-square',
        links: [
            { label: 'Jeux', to: '/games', icon: 'i-heroicons-cube' },
            { label: 'Personnages', to: '/characters', icon: 'i-heroicons-identification' },
            { label: 'Groupes', to: '/factions', icon: 'i-heroicons-user-group' },
            { label: 'Intrigues', to: '/intrigues', icon: 'i-heroicons-book-open' },
            { label: 'Objets', to: '/items', icon: 'i-heroicons-archive-box' }
        ]
    },
    {
        label: 'Organisation',
        icon: 'i-heroicons-calendar-days',
        links: [
            { label: 'Joueurs', to: '/players', icon: 'i-heroicons-users' },
            { label: 'Lieux', to: '/locations', icon: 'i-heroicons-map-pin' },
            { label: 'Sessions', to: '/sessions', icon: 'i-heroicons-calendar-days' }
        ]
    }
]

const userMenu = [
    [
        {
            label: 'Déconnexion',
            icon: 'i-heroicons-arrow-left-on-rectangle',
            onSelect: () => navigateTo('/logout')
        }
    ]
]

const isActive = (path) => {
    if (path === '/') {
        return route.path === '/'
    }

    return route.path === path || route.path.startsWith(`${path}/`)
}

const toggleSidebar = () => {
    sidebarCollapsed.value = !sidebarCollapsed.value
}

onMounted(() => {
    const saved = localStorage.getItem('limbus-sidebar-collapsed')
    sidebarCollapsed.value = saved === 'true'
    document.documentElement.style.setProperty('--limbus-sidebar-width', sidebarCollapsed.value ? '5rem' : '16rem')
})

watch(sidebarCollapsed, (value) => {
    if (!import.meta.client) return

    localStorage.setItem('limbus-sidebar-collapsed', String(value))
    document.documentElement.style.setProperty('--limbus-sidebar-width', value ? '5rem' : '16rem')
})
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
