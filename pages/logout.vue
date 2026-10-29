<script setup>
import { clearOfflineData, markPendingLogout } from '~/utils/storage'

if (import.meta.client) {
    // Sans réseau, l'appareil est effacé quand même ; la déconnexion part au retour du réseau (US-051)
    let pending = !navigator.onLine
    if (!pending) {
        try {
            await $fetch('/api/auth/logout', { method: 'POST' })
        } catch {
            pending = true
        }
    }
    // Rien ne reste sur l'appareil : cache des données, écritures en attente, photos, PDF
    await clearOfflineData()
    if (pending) markPendingLogout()
    window.dispatchEvent(new CustomEvent('limbus:auth-change'))
    await navigateTo('/', { replace: true })
}
</script>
