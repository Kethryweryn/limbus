// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  srcDir: '.',
  dir: {
    app: 'app'
  },
  css: ['~/assets/css/main.css'],
  // Valeurs vides au build : les secrets sont lus dans l'environnement au démarrage
  // (JWT_SECRET, SMTP_ENCRYPTION_SECRET, PUBLIC_APP_URL). Un process.env ici serait
  // figé en clair dans .output au moment du build.
  runtimeConfig: {
    jwtSecret: '',
    smtpEncryptionSecret: '',
    publicAppUrl: ''
  },
  // Pages des liens personnels, d'inscription et de présence (ADR-0018) : le jeton est dans l'URL, il ne doit fuiter
  // ni par le Referer, ni par un cache, ni par un moteur de recherche
  routeRules: {
    '/presence/**': {
      headers: { 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }
    },
    '/inscription/**': {
      headers: { 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }
    }
  },
  nitro: {
    preset: 'node-server', // 👈 force l'utilisation du serveur Node natif
    prerender: {
      routes: ["/", "/robots.txt"]
    }
  },
  compatibilityDate: '2025-04-07',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@nuxt/eslint', '@pinia/nuxt', '@vite-pwa/nuxt'],
  devServer: {
    host: '0.0.0.0',
    port: 3000,
  },
  pwa: {
    registerType: 'autoUpdate',
    injectRegister: false,
    pwaAssets: {
      disabled: false,
      config: true
    },
    manifest: {
      name: 'Limbus',
      short_name: 'Limbus',
      description: 'Application GN utilisable hors-ligne',
      lang: 'fr',
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
      navigateFallback: null,
      globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      cleanupOutdatedCaches: true,
      clientsClaim: true,
      runtimeCaching: [
        {
          urlPattern: /^\/api\/uploads\/session-assignment-photos\/.+/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'session-assignment-photos',
            expiration: {
              maxEntries: 300,
              maxAgeSeconds: 60 * 60 * 24 * 30
            },
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        }
      ]
    },
    devOptions: {
      enabled: false,
      suppressWarnings: true,
      navigateFallback: '/',
      navigateFallbackAllowlist: [/^\/$/],
      type: 'module',
    },

    registerWebManifestInRouteRules: true,
  },
})
