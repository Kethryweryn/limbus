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
    },
    // Lien de diffusion (ADR-0046) : public et indexable, mais prérempli pour une personne connectée
    '/i/**': {
      headers: { 'Cache-Control': 'private, no-store' }
    },
    // Page « Autoriser » d'un assistant d'IA (US-121) : jamais dans un cadre, jamais en cache
    '/autoriser/**': {
      headers: { 'X-Frame-Options': 'DENY', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }
    }
  },
  // Découverte OAuth pour les assistants d'IA (US-121), aux adresses `/.well-known` fixées par les RFC 9728 et 8414
  serverHandlers: [
    { route: '/.well-known/oauth-protected-resource/mcp', handler: '~~/server/handlers/protectedResource.ts' },
    { route: '/.well-known/oauth-protected-resource', handler: '~~/server/handlers/protectedResource.ts' },
    { route: '/.well-known/oauth-authorization-server', handler: '~~/server/handlers/authorizationServer.ts' }
  ],
  nitro: {
    preset: 'node-server', // 👈 force l'utilisation du serveur Node natif
    prerender: {
      routes: ["/", "/robots.txt"]
    }
  },
  compatibilityDate: '2025-04-07',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@nuxt/eslint', '@pinia/nuxt', '@vite-pwa/nuxt', 'nuxt-security'],
  // CSP et COOP posées par l'application, d'abord en mode rapport (US-106, ADR-0053). Le reste du module est désactivé :
  // Limbus a ses propres limites de débit, de taille et contrôles d'origine, et Apache pose HSTS
  security: {
    headers: {
      contentSecurityPolicy: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'nonce-{{nonce}}'", "'strict-dynamic'"],
        'script-src-attr': ["'none'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        'font-src': ["'self'", 'data:'],
        'connect-src': ["'self'"],
        'frame-src': ['https://www.youtube.com'],
        'worker-src': ["'self'"],
        'manifest-src': ["'self'"],
        'object-src': ["'none'"],
        'base-uri': ["'none'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'self'"],
        'report-uri': ['/api/public/csp-report'],
        'upgrade-insecure-requests': false
      },
      crossOriginOpenerPolicy: 'same-origin',
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: false,
      originAgentCluster: false,
      referrerPolicy: false,
      strictTransportSecurity: false,
      xContentTypeOptions: false,
      xDNSPrefetchControl: false,
      xDownloadOptions: false,
      xFrameOptions: false,
      xPermittedCrossDomainPolicies: false,
      xXSSProtection: false,
      permissionsPolicy: false
    },
    contentSecurityPolicyReportOnly: true,
    nonce: true,
    // Page prérendue (/) : CSP par les en-têtes de Nitro, jamais par une balise meta, qui ne connaît pas le mode rapport
    ssg: { meta: false, hashScripts: true, hashStyles: false, nitroHeaders: true, exportToPresets: false },
    requestSizeLimiter: false,
    rateLimiter: false,
    xssValidator: false,
    corsHandler: false,
    allowedMethodsRestricter: false,
    removeLoggers: false,
    sri: false,
    hidePoweredBy: false
  },
  devServer: {
    host: '0.0.0.0',
    port: 3000,
  },
  pwa: {
    // Une nouvelle version attend le prochain changement de page (plugins/pwaUpdate.client.ts, ADR-0071) : le mode
    // automatique rechargeait la page ouverte, saisie en cours comprise
    registerType: 'prompt',
    injectRegister: false,
    // Inscription faite par plugins/serviceWorker.client.ts, qui ne l'inscrit pas quand le hors ligne est désactivé
    // sur l'appareil (SPEC-019, R5)
    client: { registerPlugin: false },
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
          // Documents reçus d'une participante (PDF, photos) : jamais gardés en passant ; sans réseau, ceux de ses sessions
          // à venir téléchargées (SPEC-019, R16)
          urlPattern: /\/api\/me\/documents\/[^/]+\/(?:pdf|photos\/\d+)$/,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'me-documents',
            networkTimeoutSeconds: 10,
            plugins: [{
              cacheWillUpdate: async () => null,
              cachedResponseWillBeUsed: async ({ request, cachedResponse }: { request: Request, cachedResponse?: Response }) =>
                cachedResponse || await (await caches.open('offline-downloads')).match(request.url)
            }]
          }
        },
        {
          // Workbox compare l'URL complète (https://…) : le motif ne commence donc pas par ^
          urlPattern: /\/api\/uploads\/session-assignment-photos\/.+/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'session-assignment-photos',
            // Sans réseau, le fichier d'un jeu téléchargé (SPEC-019, R9 ; ADR-0081) : la fonction est recopiée telle quelle
            // dans le service worker, elle ne référence rien du fichier
            plugins: [{
              cachedResponseWillBeUsed: async ({ request, cachedResponse }: { request: Request, cachedResponse?: Response }) =>
                cachedResponse || await (await caches.open('offline-downloads')).match(request.url)
            }],
            expiration: {
              maxEntries: 300,
              maxAgeSeconds: 60 * 60 * 24 * 30
            },
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        },
        {
          // PDF d'une session consultés avec le réseau : trombinoscopes, fiches de personnage, fiche allergies (US-047)
          urlPattern: /\/api\/sessions\/[^/]+\/(?:trombinoscopes\/[^/?]+|allergies\/pdf|documents\/(?:[^/]+|character-sheets\/[^/]+)\/pdf)(?:\?.*)?$/,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'session-documents',
            // Sans réseau, le fichier d'un jeu téléchargé (SPEC-019, R9 ; ADR-0081) : la fonction est recopiée telle quelle
            // dans le service worker, elle ne référence rien du fichier
            plugins: [{
              cachedResponseWillBeUsed: async ({ request, cachedResponse }: { request: Request, cachedResponse?: Response }) =>
                cachedResponse || await (await caches.open('offline-downloads')).match(request.url)
            }],
            networkTimeoutSeconds: 10,
            expiration: {
              maxEntries: 200,
              maxAgeSeconds: 60 * 60 * 24 * 30
            },
            cacheableResponse: {
              statuses: [200]
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
