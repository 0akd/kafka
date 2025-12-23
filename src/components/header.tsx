import { component$, useSignal } from '@builder.io/qwik';
import { Form, Link } from '@builder.io/qwik-city';

interface HeaderProps {
  user: any;
  logoutAction: any;
}

export const Header = component$(({ user, logoutAction }: HeaderProps) => {
  const isDropdownOpen = useSignal(false);

  return (
    <header class="bg-slate-900 text-white py-6 px-6 shadow-md">
      <div class="max-w-[1400px] mx-auto flex justify-between items-center">
        {/* Logo & Brand */}
        <div>
          <Link href="/" class="text-3xl font-bold hover:text-blue-400 transition-colors">
            Kafka Book Store
          </Link>
          <p class="text-slate-400 mt-1 hidden sm:block">
            Master event streaming with our curated collection.
          </p>
        </div>

        {/* Navigation & Auth */}
        <div class="flex items-center gap-6">
          {/* Part Link */}
          <Link 
            href="/part" 
            class="text-sm font-medium hover:text-blue-400 transition-colors"
          >
            Go to Part
          </Link>

          {/* User Section */}
          <div class="relative">
            {user ? (
              <div class="relative">
                <button 
                  onClick$={() => (isDropdownOpen.value = !isDropdownOpen.value)}
                  class="flex items-center gap-2 bg-slate-800 p-1 pr-3 rounded-full border border-slate-700 hover:bg-slate-700 transition-all"
                >
                  {user.picture && (
                    <img
                      src={user.picture}
                      class="w-8 h-8 rounded-full"
                      alt="User"
                      width={32}
                      height={32}
                    />
                  )}
                  <span class="text-sm font-bold hidden sm:block">{user.name}</span>
                  <span class="text-[10px]">▼</span>
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen.value && (
                  <div class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl py-2 z-[100] border border-slate-200">
                     <div class="px-4 py-2 border-b border-slate-100 sm:hidden">
                        <p class="text-xs font-bold text-slate-900">{user.name}</p>
                     </div>
                     <Form action={logoutAction}>
                      <button 
                        type="submit"
                        class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-bold"
                      >
                        Logout
                      </button>
                    </Form>
                  </div>
                )}
              </div>
            ) : (
              <div id="google-btn-container" class="shadow-md rounded bg-white overflow-hidden"></div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
});