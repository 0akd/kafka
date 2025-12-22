import { Router } from 'express';
import { db } from '../db/client';
import { books } from '../db/schema';

const router = Router();

/**
 * GET /api/books
 */
router.get('/', async (_req, res) => {
  try {
    const result = await db.select().from(books);
    res.json(result);
  } catch (err) {
  console.error('❌ Books fetch error FULL:', err);
  res.status(500).json({
    error: 'Failed to fetch books',
    details: String(err),
  });
}

});

export default router;
