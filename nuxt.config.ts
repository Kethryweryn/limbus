// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  nitro: {
    devProxy: false,
    preset: 'node-server', // 👈 force l'utilisation du serveur Node natif
  },
  compatibilityDate: '2025-04-07',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@nuxt/eslint', '@pinia/nuxt', '@vite-pwa/nuxt'],
  ui: {
    icons: ['heroicons']
  },
  devServer: {
    host: '0.0.0.0',
    port: 3000,
  },
  serverMiddleware: [
  ],
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Limbus',
      short_name: 'Limbus',
      description: 'Application GN utilisable hors-ligne',
      lang: 'fr',
      start_url: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#000000',
      icons: [
        {
          src: '/pwa-192x192.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: '/pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png'
        },
        {
          src: 'pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ]
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      //navigateFallbackDenylist: [/^\/api/]
    }
  },
})
