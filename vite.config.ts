import { defineConfig, loadEnv } from 'vite';
import { qwikVite } from '@builder.io/qwik/optimizer';
import { qwikCity } from '@builder.io/qwik-city/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(({ mode }) => {
  // 1. .env file load karo
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [qwikCity(), qwikVite(), tsconfigPaths()],
    
    // 👇 2. YE DEFINE BLOCK ADD KARO (Most Important)
    // Ye build time par process.env variables ko real string value se replace kar dega
    define: {
      'process.env.TURSO_CONNECTION_URL': JSON.stringify(env.TURSO_CONNECTION_URL),
      'process.env.TURSO_AUTH_TOKEN': JSON.stringify(env.TURSO_AUTH_TOKEN),
      // Agar aur bhi variables hain jo backend DB ke liye chahiye, unhe yahan add karo
    },

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