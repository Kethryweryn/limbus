<script setup>
import { clearOfflineData } from '~/utils/storage'

await $fetch('/api/auth/logout', { method: 'POST' })
if (import.meta.client) {
    // Rien ne reste sur l'appareil : cache des données, écritures en attente, photos
    await clearOfflineData()
    await navigateTo('/', { replace: true })
}
</script>
