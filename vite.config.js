import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'GenFlow CRM — Serfunorte',
        short_name: 'GenFlow',
        description: 'Plataforma comercial multi-área de Serfunorte Los Olivos',
        theme_color: '#004730',
        background_color: '#f9fafb',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/genflow/',
        start_url: '/genflow/',
        lang: 'es-CO',
        categories: ['business', 'productivity'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}']
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  base: '/genflow/',
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './src')
    }
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:3020',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false
  }
});
