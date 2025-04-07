<script setup>
await $fetch('/api/auth/logout', { method: 'POST' })
navigateTo('/login')
</script>