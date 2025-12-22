import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const books = sqliteTable('books', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  subtitle: text('subtitle'),
  price: integer('price').notNull(),
  currency: text('currency').default('$'),
  coverUrl: text('cover_url').notNull(),
  category: text('category').notNull(),
  // NEW: Add this line
  pdfUrl: text('pdf_url'), 
});
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // Google ID
  email: text('email').notNull().unique(),
  name: text('name'),
  picture: text('picture'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date()),
});