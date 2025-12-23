import { component$, useSignal } from '@builder.io/qwik';
import { Form, Link } from '@builder.io/qwik-city';
import { DropdownMenu } from './menu';
import { profileMenu } from '../../menu.config';

interface HeaderProps {
  user: any;
  logoutAction: any;
}

export const Header = component$(({ user, logoutAction }: HeaderProps) => {
  const isDropdownOpen = useSignal(false);

  return (
    <header class="bg-slate-900 text-white py-4 px-6 shadow-md">
      <div class="max-w-[1400px] mx-auto flex items-center justify-between">

        {/* LEFT: Profile Icon */}
        <div class="relative">
          <button
            onClick$={() => (isDropdownOpen.value = !isDropdownOpen.value)}
            class="w-10 h-10 rounded-full overflow-hidden border border-slate-700 bg-slate-800 flex items-center justify-center hover:ring-2 hover:ring-blue-400 transition"
          >
            {user?.picture ? (
              <img
                src={user.picture}
                alt="Profile"
                class="w-full h-full object-cover"
              />
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

                  {/* 🔑 NESTED MENU HERE */}
                  <DropdownMenu items={profileMenu} />
                </>
              ) : (
                <div class="px-4 py-3 text-sm text-slate-600">
                  Not logged in
                </div>
              )}
            </div>
          )}
        </div>

        {/* CENTER: Brand */}
        <div class="text-center">
          <Link href="/" class="text-2xl font-bold hover:text-blue-400">
            Kafka Book Store
          </Link>
          <p class="text-slate-400 text-sm hidden sm:block">
            Master event streaming with curated books
          </p>
        </div>

        {/* RIGHT: Logout / Login */}
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
            <div id="google-btn-container" class="bg-white rounded shadow" />
          )}
        </div>

      </div>
    </header>
  );
});
