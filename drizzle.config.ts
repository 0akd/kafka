import { defineConfig } from 'drizzle-kit';

if (!process.env.TURSO_CONNECTION_URL) throw new Error('TURSO_CONNECTION_URL is missing in .env');
if (!process.env.TURSO_AUTH_TOKEN) throw new Error('TURSO_AUTH_TOKEN is missing in .env');

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'turso', // 👈 CHANGE THIS from 'sqlite' to 'turso'
  dbCredentials: {
    url: process.env.TURSO_CONNECTION_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});