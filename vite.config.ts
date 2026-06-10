import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
// Canonical security headers — single source of truth shared with vercel.json
// (kept in sync by src/config/__tests__/securityHeaders.test.ts).
import { SECURITY_HEADERS, DEV_SECURITY_HEADERS } from './src/config/securityHeaders';

// Determine base path based on deployment target
const BASE_PATH = process.env.VERCEL ? '/' : '/TrustVault-PWA/';

// https://vitejs.dev/config/
export default defineConfig({
  // CRITICAL: Set base to '/' for Vercel deployment, '/TrustVault-PWA/' for GitHub Pages
  // Use VERCEL environment variable to detect Vercel deployment
  base: BASE_PATH,

  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // Changed from 'autoUpdate' to give user control
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'TrustVault PWA',
        short_name: 'TrustVault',
        description: 'Secure offline-first password manager',
        theme_color: '#1976d2',
        background_color: '#ffffff',
        display: 'standalone',
        scope: BASE_PATH,
        start_url: BASE_PATH,
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-maskable-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wasm}'],
        // OCR assets (~16MB total) are runtime-cached on first use, not precached
        globIgnores: ['**/ocr/**'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Self-hosted Tesseract OCR assets (worker + WASM core + language
          // data, ~16MB) — served from public/ocr/ (P2: no CDN egress).
          // Runtime-cached on first OCR use instead of precached.
          {
            urlPattern: ({ url }) => url.pathname.includes('/ocr/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'tesseract-assets-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 90 // 90 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ],
        skipWaiting: false, // Don't auto-skip waiting - let user control it
        clientsClaim: false, // Don't auto-claim clients
        // P1: serve the precached app shell for offline deep-link navigations.
        // 'index.html' resolves relative to the SW scope, so it works on both
        // GH Pages (/TrustVault-PWA/) and Vercel (/) without BASE_PATH math.
        navigateFallback: 'index.html',
        // Assets, API calls, and OCR resources must never receive the shell.
        navigateFallbackDenylist: [/^\/api\//, /\/ocr\//, /\.[a-z0-9]+$/i],
        additionalManifestEntries: undefined,
      },
      // Inject version constant into generated SW
      useCredentials: false,
      devOptions: {
        enabled: true
      }
    })
  ],
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    }
  },
  
  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'mui-vendor': ['@mui/material', '@mui/icons-material'],
          'storage-vendor': ['dexie'],
          'security-vendor': ['@noble/hashes']
        }
      }
    }
  },
  
  server: {
    port: 3000,
    strictPort: false,
    // Dev-only relaxed script-src (React-refresh inline preamble + HMR).
    // Production and `vite preview` use the strict SECURITY_HEADERS.
    headers: DEV_SECURITY_HEADERS
  },

  preview: {
    port: 4173,
    strictPort: false,
    headers: SECURITY_HEADERS
  }
});
