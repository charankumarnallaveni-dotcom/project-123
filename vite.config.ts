import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Automatically detect base path:
// - Vercel / Render / Root deployments -> '/'
// - GitHub Pages deployment workflow -> '/project-123/'
// - Custom override via VITE_BASE_PATH or BASE_PATH
const resolveBase = () => {
  if (process.env.VITE_BASE_PATH) return process.env.VITE_BASE_PATH;
  if (process.env.BASE_PATH) return process.env.BASE_PATH;
  if (process.env.VERCEL) return '/';
  if (process.env.GITHUB_ACTIONS && !process.env.VERCEL) return '/project-123/';
  return '/';
};

export default defineConfig({
  base: resolveBase(),
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-icons': ['lucide-react'],
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
  },
});
