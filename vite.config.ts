import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const supabaseUrl = env.VITE_SUPABASE_URL

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: null,
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Presupuesto Diario',
          short_name: 'Presupuesto',
          description: 'Presupuesto diario y disponible en tiempo real, con metas de ahorro y gamificación.',
          lang: 'es',
          start_url: '/',
          display: 'standalone',
          background_color: '#0a0a0a',
          theme_color: '#863bff',
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'maskable-icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
          shortcuts: [
            {
              name: 'Registrar gasto',
              short_name: 'Gasto',
              url: '/?action=registrar-gasto',
              icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          // Los datos de Supabase nunca se precachean; solo se sirven network-first
          // en runtime y sin persistir respuestas sensibles más allá de esta sesión.
          runtimeCaching: supabaseUrl
            ? [
                {
                  urlPattern: ({ url }: { url: URL }) => url.origin === new URL(supabaseUrl).origin,
                  handler: 'NetworkFirst' as const,
                  options: {
                    cacheName: 'supabase-runtime',
                    networkTimeoutSeconds: 10,
                    cacheableResponse: { statuses: [0, 200] },
                    expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
                  },
                },
              ]
            : [],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.ts',
    },
  }
})
