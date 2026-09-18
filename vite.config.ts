/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/** Nombre del repositorio en GitHub: la app se publica en https://<usuario>.github.io/<repo>/ */
const REPO_BASE = '/finanzas/';

/**
 * Content-Security-Policy (solo en el build de producción; el modo dev de Vite
 * necesita scripts en línea). La app no carga nada de otros dominios.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function securityHeaders(): Plugin {
  return {
    name: 'finanzas-security-meta',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
    ],
  };
}

export default defineConfig({
  base: REPO_BASE,
  plugins: [
    react(),
    tailwindcss(),
    securityHeaders(),
    VitePWA({
      // Se avisa cuando hay versión nueva (no se recarga sola en medio de una carga).
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        id: REPO_BASE,
        name: 'Finanzas',
        short_name: 'Finanzas',
        description: 'Finanzas personales en pesos y dólares. Los datos quedan solo en tu dispositivo.',
        lang: 'es-UY',
        dir: 'ltr',
        start_url: REPO_BASE,
        scope: REPO_BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0A0A0A',
        theme_color: '#0A0A0A',
        categories: ['finance'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Todo lo necesario para abrir sin conexión queda guardado en el teléfono.
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,webmanifest}'],
        // Las pantallas de carga las guarda iOS al instalar; la cotización va por la red.
        globIgnores: ['splash/**', 'rates/**'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Cotización: primero la red; sin conexión, la última descargada.
            urlPattern: ({ url }) => url.pathname.includes('/rates/') && url.pathname.endsWith('.json'),
            handler: 'NetworkFirst',
            options: { cacheName: 'cotizaciones', networkTimeoutSeconds: 6, expiration: { maxEntries: 4 } },
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  // Recharts se importa de forma diferida: se pre-empaqueta al arrancar para que
  // el modo dev no cargue dos copias de React.
  optimizeDeps: {
    include: ['recharts'],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.{ts,mjs}'],
    setupFiles: ['src/test/setup.ts'],
  },
});
