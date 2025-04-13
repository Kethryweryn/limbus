<script setup>
await $fetch('/api/auth/logout', { method: 'POST' })
window.location.reload()
</script>