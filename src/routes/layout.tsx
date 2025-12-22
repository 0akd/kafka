import { component$, Slot } from '@builder.io/qwik';
import { useLocation, routeLoader$, routeAction$ } from '@builder.io/qwik-city';

/* -------------------------------------------------
   1. SESSION LOADER (Edge-safe)
   ------------------------------------------------- */
export const useUserLoader = routeLoader$(async ({ cookie }) => {
  const userCookie = cookie.get('user_session');
  if (!userCookie?.value) return null;

  try {
    return JSON.parse(userCookie.value);
  } catch {
    return null;
  }
});

/* -------------------------------------------------
   2. LOGIN ACTION (CALL BACKEND API)
   ------------------------------------------------- */
export const useLoginAction = routeAction$(async (data, { cookie }) => {
  try {
    // Backend API Call
    const res = await fetch(
      `${import.meta.env.PUBLIC_BACKEND_URL}/api/auth/google`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: data.credential,
        }),
      }
    );

    if (!res.ok) {
      return { success: false, error: 'Login failed' };
    }

    const responseData = await res.json();

    // 👇 FIX 1: Backend wrapper check karein
    // Backend bhej raha hai: { success: true, user: {...} }
    // Humein sirf 'user' object chahiye.
    const userToSave = responseData.user || responseData;

    // Store session in cookie
    cookie.set('user_session', JSON.stringify(userToSave), {
      httpOnly: false, // Development me false rakhein (Production me true)
      
      // 👇 FIX 2: Localhost pe 'secure: true' cookie set hone nahi deta
      // Jab production me HTTPS pe dalein tab ise true karein
      secure: false, 
      
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      sameSite: 'lax',
    });

    return { success: true };
  } catch (err) {
    console.error('Login Action Error:', err);
    return { success: false, error: 'Login failed' };
  }
});

/* -------------------------------------------------
   3. LOGOUT ACTION
   ------------------------------------------------- */
export const useLogoutAction = routeAction$(async (_, { cookie }) => {
  cookie.delete('user_session', { path: '/' });
  return { success: true };
});

/* -------------------------------------------------
   4. LAYOUT COMPONENT
   ------------------------------------------------- */
export default component$(() => {
  const loc = useLocation();

  return (
    <>
      {loc.isNavigating && (
        <div class="fixed top-0 left-0 h-1 bg-blue-600 z-50 animate-pulse w-full"></div>
      )}

      <main>
        <Slot />
      </main>
    </>
  );
});