import 'dotenv/config';
import { createClient } from '@libsql/client/web'; // ✅ Ye Edge friendly hai (fetch use karta hai)
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

const url = process.env.TURSO_CONNECTION_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

// Debug log to confirm credentials are found (Check your terminal when running)
console.log('Database Connection:', url ? '✅ URL Found' : '❌ URL Missing');

if (!url || !authToken) {
  throw new Error('Missing TURSO credentials in .env file');
}

// Disable TLS if using a local URL (rare), otherwise default
const client = createClient({ 
  url, 
  authToken,
});

export const db = drizzle(client, { schema });