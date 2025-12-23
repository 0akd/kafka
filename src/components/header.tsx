import { component$, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { Form, Link, type ActionStore } from '@builder.io/qwik-city';
import { DropdownMenu } from './menu';
import { profileMenu } from '../../menu.config';

// Robust Type Definition
declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (parent: Element, options: any) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface HeaderProps {
  user: any;
  logoutAction: ActionStore<void, any>; // Type for the Logout Action
  loginAction: ActionStore<void, any>;  // Type for the Login Action
}

export const Header = component$(({ user, logoutAction, loginAction }: HeaderProps) => {
  const isDropdownOpen = useSignal(false);
  const googleBtnRef = useSignal<HTMLElement>(); 

  // ✅ GOOGLE AUTH LOGIC (Centralized here)
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    track(() => user);

    // If user is already logged in, do nothing
    if (user) return;

    // 1. Function to init Google Button
    const initGoogle = () => {
      if (window.google?.accounts?.id && googleBtnRef.value) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.PUBLIC_GOOGLE_CLIENT_ID, // Use env variable
          callback: (response: any) => {
            // 2. TRIGGER SERVER ACTION
            // Find the hidden form fields and submit them programmatically
            const tokenInput = document.getElementById('google-token-input') as HTMLInputElement;
            const submitBtn = document.getElementById('google-submit-btn') as HTMLButtonElement;
            
            if (tokenInput && submitBtn) {
              tokenInput.value = response.credential;
              submitBtn.click(); // This triggers loginAction
            }
          },
        });

        window.google.accounts.id.renderButton(googleBtnRef.value, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
        });
      }
    };

    // 3. Load Script if not present, otherwise just init
    if (!window.google?.accounts) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initGoogle;
      document.body.appendChild(script);
    } else {
      initGoogle();
    }
  });

  return (
    <header class="bg-slate-900 text-white py-4 px-6 shadow-md relative z-40">
      <div class="max-w-[1400px] mx-auto flex items-center justify-between">

        {/* LEFT: PROFILE ICON */}
        <div class="relative">
          <button
            type="button"
            onClick$={() => (isDropdownOpen.value = !isDropdownOpen.value)}
            class="w-10 h-10 rounded-full overflow-hidden border border-slate-700 bg-slate-800 flex items-center justify-center hover:ring-2 hover:ring-blue-400 transition"
          >
            {user?.picture ? (
              <img src={user.picture} alt="Profile" class="w-full h-full object-cover" />
            ) : (
              <span class="text-slate-400 text-lg">👤</span>
            )}
          </button>

          {isDropdownOpen.value && (
            <div class="absolute left-0 mt-2 w-56 bg-white rounded-lg shadow-xl z-50 border border-slate-200">
              {user ? (
                <>
                  <div class="px-4 py-3 border-b">
                    <p class="text-sm font-bold text-slate-900">{user.name}</p>
                    <p class="text-xs text-slate-500">{user.email}</p>
                  </div>
                  <DropdownMenu items={profileMenu} />
                </>
              ) : (
                <div class="px-4 py-3 text-sm text-slate-600">Not logged in</div>
              )}
            </div>
          )}
        </div>

        {/* CENTER: BRAND */}
        <div class="text-center">
          <Link href="/" class="text-2xl font-bold hover:text-blue-400">
            Kafka Book Store
          </Link>
          <p class="text-slate-400 text-sm hidden sm:block">
            Master event streaming with curated books
          </p>
        </div>

        {/* RIGHT: AUTH */}
        <div class="flex items-center gap-4">
          <Link href="/part" class="text-sm font-medium hover:text-blue-400">
            Go to Part
          </Link>

          {user ? (
            <Form action={logoutAction}>
              <button
                type="submit"
                class="px-4 py-2 text-sm font-bold text-red-500 border border-red-500 rounded hover:bg-red-500 hover:text-white transition"
              >
                Logout
              </button>
            </Form>
          ) : (
            <>
              {/* Container for Google Button */}
              <div ref={googleBtnRef} class="min-w-[180px] min-h-[40px]" />

              {/* HIDDEN FORM FOR LOGIN CALLBACK */}
              <Form action={loginAction} class="hidden">
                <input type="hidden" name="credential" id="google-token-input" />
                <button type="submit" id="google-submit-btn">Sign In</button>
              </Form>
            </>
          )}
        </div>
      </div>
    </header>
  );
});