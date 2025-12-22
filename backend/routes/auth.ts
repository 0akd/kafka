import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { db } from '../db/client';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID
);

/**
 * POST /api/auth/google
 */
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ error: 'Missing credential' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    // Check existing user
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, payload.email))
      .get();

    if (!existingUser) {
      await db.insert(users).values({
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      });
    }

    // Return SAFE user object
    res.json({
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    });

  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

export default router;
