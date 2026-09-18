/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

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
  plugins: [react(), tailwindcss(), securityHeaders()],
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
