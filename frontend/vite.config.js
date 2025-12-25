import { defineConfig } from 'vite';
import { transformSync } from 'esbuild';
import react from '@vitejs/plugin-react-swc';
import { sentryVitePlugin } from "@sentry/vite-plugin";

const jsxInJsPlugin = {
  name: 'jsx-in-js',
  enforce: 'pre',
  transform(code, id) {
    if (!id.endsWith('.js') || id.includes('node_modules')) return null;
    return transformSync(code, {
      loader: 'jsx',
      jsx: 'automatic',
      sourcemap: true
    });
  }
};

export default defineConfig({
  plugins: [
    jsxInJsPlugin,
    react({
      include: [/\.(j|t)sx?$/]
    }),
    // Sentry source map upload (only in production)
    process.env.NODE_ENV === 'production' && sentryVitePlugin({
      org: process.env.SENTRY_ORG || "club-attendance-manager",
      project: process.env.SENTRY_PROJECT || "club-attendance-frontend",
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        assets: "./dist/**",
      },
    }),
  ].filter(Boolean),

  build: {
    sourcemap: true, // Source maps for Sentry
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor code into separate chunks
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['@headlessui/react', '@heroicons/react'],
        },
      },
    },
  },

  server: {
    port: 5173,
    host: true,
    strictPort: true,
    watch: {
      usePolling: true,
    },
  },
});