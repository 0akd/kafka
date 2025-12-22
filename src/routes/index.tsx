import { component$, useVisibleTask$ } from '@builder.io/qwik';
import { routeLoader$, Form, Link } from '@builder.io/qwik-city';
import { useLoginAction, useLogoutAction, useUserLoader } from './layout';

/* -------------------------------------------------
   SERVER LOADER — FETCH BOOKS FROM BACKEND API
   ------------------------------------------------- */
export const useBooksLoader = routeLoader$(async () => {
  const res = await fetch(
    `${import.meta.env.PUBLIC_BACKEND_URL}/api/books`
  );

  if (!res.ok) {
    throw new Error('Failed to fetch books');
  }

  return res.json() as Promise<Array<{
    id: number;
    title: string;
    price: number;
    coverUrl: string;
    category: string;
  }>>;
});

/* -------------------------------------------------
   MAIN COMPONENT
   ------------------------------------------------- */
export default component$(() => {
  const user = useUserLoader();
  const loginAction = useLoginAction();
  const logoutAction = useLogoutAction();
  const booksSignal = useBooksLoader();

  /* -------------------------------------------------
     GOOGLE SCRIPT & BUTTON LOGIC
     ------------------------------------------------- */
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    track(() => user.value);

    if (!user.value) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);

      (window as any).handleGoogleCredential = (response: any) => {
        const input = document.getElementById(
          'google-token-input'
        ) as HTMLInputElement;

        const submitBtn = document.getElementById(
          'google-submit-btn'
        ) as HTMLButtonElement;

        if (input && submitBtn) {
          input.value = response.credential;
          submitBtn.click();
        }
      };

      script.onload = () => {
        const google = (window as any).google;
        if (!google) return;

        google.accounts.id.initialize({
          client_id: import.meta.env.PUBLIC_GOOGLE_CLIENT_ID,
          callback: (window as any).handleGoogleCredential,
        });

        google.accounts.id.renderButton(
          document.getElementById('google-btn-container'),
          { theme: 'outline', size: 'large' }
        );

        google.accounts.id.prompt();
      };
    }
  });

  /* -------------------------------------------------
     GROUP BOOKS BY CATEGORY
     ------------------------------------------------- */
  const groupedBooks = booksSignal.value.reduce((acc, book) => {
    const cat = book.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(book);
    return acc;
  }, {} as Record<string, typeof booksSignal.value>);

  const sortedCategories = Object.keys(groupedBooks).sort();
  const capitalize = (s: string) =>
    s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <div class="min-h-screen bg-slate-50 font-sans pb-20 relative">

      {/* AUTH BAR */}
      <div class="absolute top-4 right-6 z-50">
        {user.value ? (
          <div class="flex items-center gap-3 bg-white p-2 rounded-full shadow-lg border border-slate-100">
            {user.value.picture && (
              <img
                src={user.value.picture}
                class="w-8 h-8 rounded-full"
                alt="User"
                width={32}
                height={32}
              />
            )}
            <span class="text-sm font-bold text-slate-700 hidden sm:block">
              {user.value.name}
            </span>

            <Form action={logoutAction}>
              <button class="bg-red-100 text-red-600 px-3 py-1 rounded-full text-xs font-bold hover:bg-red-200">
                Logout
              </button>
            </Form>
          </div>
        ) : (
          <div id="google-btn-container" class="shadow-md rounded bg-white"></div>
        )}
      </div>

      {/* HIDDEN LOGIN FORM */}
      <Form action={loginAction} class="hidden">
        <input type="hidden" name="credential" id="google-token-input" />
        <button type="submit" id="google-submit-btn">Login</button>
      </Form>

      {/* HERO */}
      <div class="bg-slate-900 text-white py-12 px-6 mb-8">
        <div class="max-w-[1400px] mx-auto">
          <h1 class="text-3xl font-bold">Kafka Book Store</h1>
          <p class="text-slate-400 mt-2">
            Master event streaming with our curated collection.
          </p>
        </div>
      </div>

      {/* BOOK LIST */}
      <div class="max-w-[1400px] mx-auto px-6 space-y-12">
        {sortedCategories.map((category) => (
          <div key={category}>
            <div class="flex items-center gap-4 mb-6">
              <h2 class="text-2xl font-bold text-slate-900">
                {capitalize(category)} Books
              </h2>
              <div class="h-px bg-slate-200 flex-grow"></div>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {groupedBooks[category].map((book) => (
                <Link
                  key={book.id}
                  href={`/product/${book.id}`}
                  class="block group"
                >
                  <div class="bg-white p-4 rounded-xl shadow-sm group-hover:shadow-xl border group-hover:border-blue-100 h-full flex flex-col">
                    <div class="aspect-[2/3] mb-4 rounded-lg overflow-hidden bg-slate-100">
                      <img
                        src={book.coverUrl}
                        alt={book.title}
                        class="w-full h-full object-cover group-hover:scale-110 transition-transform"
                      />
                    </div>

                    <h3 class="font-bold text-slate-900 mb-2 line-clamp-2">
                      {book.title}
                    </h3>

                    <div class="mt-auto flex justify-between items-center">
                      <span class="text-slate-500 font-medium">
                        ${(book.price / 100).toFixed(2)}
                      </span>
                      <span class="text-[10px] font-bold uppercase bg-slate-100 px-2 py-1 rounded">
                        {category}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}

        {booksSignal.value.length === 0 && (
          <div class="text-center py-20 text-slate-400 bg-white rounded-xl border border-dashed">
            No books available.
          </div>
        )}
      </div>
    </div>
  );
});
