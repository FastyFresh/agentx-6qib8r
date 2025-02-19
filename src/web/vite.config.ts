import { defineConfig } from 'vite'; // ^4.4.0
import react from '@vitejs/plugin-react'; // ^4.0.0
import checker from 'vite-plugin-checker'; // ^0.6.0
import path from 'node:path';

export default defineConfig({
  // Root directory and base URL configuration
  root: process.cwd(),
  base: '/',

  // Plugin configuration
  plugins: [
    // React plugin with emotion support for styled components
    react({
      fastRefresh: true,
      babel: {
        plugins: ['@emotion/babel-plugin']
      }
    }),
    // Runtime type checking and linting
    checker({
      typescript: true,
      eslint: {
        lintCommand: 'eslint src/**/*.{ts,tsx}'
      },
      overlay: true
    })
  ],

  // Path resolution and aliases
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@utils': path.resolve(__dirname, 'src/utils')
    }
  },

  // Development server configuration
  server: {
    port: 3000,
    host: true,
    strictPort: true,
    cors: true,
    // Proxy configuration for API and WebSocket connections
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
        headers: {
          'Connection': 'keep-alive'
        }
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/ws/, '')
      }
    },
    hmr: {
      overlay: true
    }
  },

  // Production build configuration
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser',
    target: 'es2020',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // Intelligent chunk splitting for optimal loading
          vendor: ['react', 'react-dom', 'react-router-dom'],
          redux: ['@reduxjs/toolkit', 'react-redux'],
          query: ['react-query'],
          ui: ['@mui/material', '@emotion/react'],
          charts: ['recharts', 'd3'],
          utils: ['date-fns', 'lodash']
        }
      }
    }
  },

  // Dependency optimization
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@reduxjs/toolkit',
      'react-query',
      '@mui/material',
      'recharts',
      'date-fns',
      'lodash'
    ],
    exclude: ['@emotion/react']
  },

  // ESBuild configuration
  esbuild: {
    jsxInject: "import React from 'react'",
    target: 'es2020',
    legalComments: 'none'
  }
});