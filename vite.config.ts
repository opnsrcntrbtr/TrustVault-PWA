import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
// Canonical security headers — single source of truth shared with vercel.json
// (kept in sync by src/config/__tests__/securityHeaders.test.ts).
import { SECURITY_HEADERS } from './src/config/securityHeaders';

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
          // Tesseract.js WASM core and worker scripts
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/tesseract\.js@.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tesseract-core-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Tesseract.js language data (eng.traineddata ~15MB)
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/tesseract\.js-data@.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tesseract-lang-cache',
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 60 * 60 * 24 * 90 // 90 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Tesseract.js WASM core from tessdata CDN
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/tesseract\.js-core@.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tesseract-wasm-cache',
              expiration: {
                maxEntries: 5,
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
        // Inject custom code for version and message handling
        navigateFallback: null,
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
  
  optimizeDeps: {
    exclude: ['argon2-browser']
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
    headers: SECURITY_HEADERS
  },

  preview: {
    port: 4173,
    strictPort: false,
    headers: SECURITY_HEADERS
  }
});
