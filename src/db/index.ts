import 'dotenv/config';
import { createClient } from '@libsql/client/web'; // ✅ Ye Edge friendly hai (fetch use karta hai)
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

const url = "libsql://kafka-books-arjundubey.aws-eu-west-1.turso.io";
const authToken = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NjYyNDIwOTIsImlkIjoiZmY3OWRhMGQtMzhkMi00ODhkLWFhNGUtNTk1YzUxOGU2YTBhIiwicmlkIjoiOTE5MTlmZTYtZjg0Ny00OTc3LWFhZjItY2NjOTA2MjMwNDEzIn0.IvUiSVTlyPTEvlAoTuKYjWvYCw44A8ssG0bqTqZiIBgEDRS4JTdq0--m9Op8OeIktvLjsM2X-G1YnZuY1QQGDA";

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