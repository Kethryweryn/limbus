export default defineNuxtRouteMiddleware(async (to, from) => {
    const res = await $fetch('/api/auth/me', {
        credentials: 'include'
    });
    if (!res.authenticated) {
        return navigateTo('/login');
    }
});
