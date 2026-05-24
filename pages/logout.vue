<script setup>
await $fetch('/api/auth/logout', { method: 'POST' })
if (process.client) {
    localStorage.removeItem('offlineAuth')
    await navigateTo('/', { replace: true })
}
</script>
