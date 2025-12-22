import { defineConfig, loadEnv } from 'vite';
import { qwikVite } from '@builder.io/qwik/optimizer';
import { qwikCity } from '@builder.io/qwik-city/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(({ mode }) => {
  // Local development ke liye .env load kar rahe hain
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [qwikCity(), qwikVite(), tsconfigPaths()],
    
    // ❌ Maine 'define' block hata diya hai.
    // Ab Vercel par code 'process.env' se live values uthayega.

    optimizeDeps: {
      exclude: ['@libsql/client', 'drizzle-orm'],
    },
    
    preview: {
      headers: {
        'Cache-Control': 'public, max-age=600',
      },
    },
  };
});