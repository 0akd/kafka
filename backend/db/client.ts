import 'dotenv/config';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema.js';

const url = process.env.TURSO_DATABASE_URL!;
const authToken = process.env.TURSO_AUTH_TOKEN!;

if (!url || !authToken) {
  throw new Error('Missing Turso credentials');
}

const client = createClient({
  url,        // ← MUST be libsql://
  authToken,
});

export const db = drizzle(client, { schema });
