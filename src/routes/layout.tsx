import { component$, Slot } from '@builder.io/qwik';
import { useLocation, routeLoader$, routeAction$ } from '@builder.io/qwik-city';
import { OAuth2Client } from 'google-auth-library';
import { db } from '~/db';
import { users } from '~/db/schema';
import { eq } from 'drizzle-orm';

// --- 1. SESSION LOADER (Check if user is logged in) ---
// Yeh har page load par check karega ki user logged in hai ya nahi
export const useUserLoader = routeLoader$(async ({ cookie }) => {
  const userCookie = cookie.get('user_session');
  if (!userCookie?.value) return null;
  
  // Cookie se data padh kar wapas bhej do (Fastest)
  return JSON.parse(userCookie.value);
});

// --- 2. LOGIN ACTION (Backend Logic) ---
// Google Token verify karega aur Turso DB mein save karega
export const useLoginAction = routeAction$(async (data, { cookie, env }) => {
  const googleClient = new OAuth2Client(env.get('GOOGLE_CLIENT_ID'));
  
  try {
    // A. Google Token Verify
    const ticket = await googleClient.verifyIdToken({
      idToken: data.credential as string,
      audience: env.get('GOOGLE_CLIENT_ID'),
    });
    const payload = ticket.getPayload();
    if (!payload) throw new Error("Invalid Token");

    // B. Check karo user Turso DB mein hai ya nahi
    const existingUser = await db.select().from(users).where(eq(users.email, payload.email!)).get();

    if (!existingUser) {
      // C. Naya user hai toh Insert karo
      await db.insert(users).values({
        id: payload.sub,
        email: payload.email!,
        name: payload.name,
        picture: payload.picture,
      });
    }

    // D. Session Cookie Set karo (1 Week ke liye)
    const sessionData = JSON.stringify({
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      picture: payload.picture
    });

    cookie.set('user_session', sessionData, {
      httpOnly: true,
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    return { success: true };
    
  } catch (error) {
    console.error(error);
    return { success: false, error: 'Login Failed' };
  }
});

// --- 3. LOGOUT ACTION ---
export const useLogoutAction = routeAction$(async (_, { cookie }) => {
  cookie.delete('user_session', { path: '/' });
  return { success: true };
});

// --- FRONTEND COMPONENT ---
export default component$(() => {
  // 1. Get the current location object (Your existing code)
  const loc = useLocation();

  return (
    <>
      {/* 2. Show this bar ONLY when navigating (Your existing code) */}
      {loc.isNavigating && (
        <div class="fixed top-0 left-0 h-1 bg-blue-600 z-50 animate-pulse w-full"></div>
      )}
      
      <main>
        <Slot />
      </main>
    </>
  );
});