import { component$ } from '@builder.io/qwik';
import { routeLoader$, Link } from '@builder.io/qwik-city';
import { useLoginAction, useLogoutAction, useUserLoader } from './layout';
import { Header } from '../components/header'; // Update path if needed

// 1. SERVER LOADER
export const useBooksLoader = routeLoader$(async () => {
  const backendUrl = import.meta.env.PUBLIC_BACKEND_URL;
  
  // Artificial delay for UX testing (optional)
  await new Promise((resolve) => setTimeout(resolve, 500));

  const res = await fetch(`${backendUrl}/api/books`, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    console.error('Fetch error:', res.statusText);
    return []; // Return empty array on failure instead of crashing
  }

  const jsonResponse = await res.json();
  const rawData = jsonResponse.data || [];

  return rawData.map((book: any) => ({
    id: book.id,
    title: book.title,
    subtitle: book.subtitle,
    price: book.price,
    currency: book.currency,
    coverUrl: book.coverUrl || book.cover_url, // Handle snake_case or camelCase
    category: book.category,
    pdfUrl: book.pdfUrl || book.pdf_url      
  }));
});

export default component$(() => {
  // 2. HOOKS
  const user = useUserLoader();
  const loginAction = useLoginAction();   // Get Login Action
  const logoutAction = useLogoutAction(); // Get Logout Action
  const booksSignal = useBooksLoader();

  // 3. DATA PROCESSING
  const books = Array.isArray(booksSignal.value) ? booksSignal.value : [];
  
  const groupedBooks = books.reduce((acc, book) => {
    const cat = book.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(book);
    return acc;
  }, {} as Record<string, any[]>);

  const sortedCategories = Object.keys(groupedBooks).sort();
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <div class="min-h-screen bg-slate-50 font-sans pb-20">
      
      {/* ✅ KEY FIX: Pass BOTH actions to Header.
         The Header now handles the Google Script and the actual login submission.
      */}
      <Header 
        user={user.value} 
        logoutAction={logoutAction} 
        loginAction={loginAction} 
      />

      {/* BOOK LIST */}
      <div class="max-w-[1400px] mx-auto px-6 space-y-12 mt-12">
        {sortedCategories.map((category) => (
          <div key={category}>
            <div class="flex items-center gap-4 mb-6">
              <h2 class="text-2xl font-bold text-slate-900">{capitalize(category)} Books</h2>
              <div class="h-px bg-slate-200 flex-grow"></div>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {groupedBooks[category].map((book: any) => (
                <Link key={book.id} href={`/product/${book.id}`} class="block group">
                  <div class="bg-white p-4 rounded-xl shadow-sm group-hover:shadow-xl border h-full flex flex-col transition-all">
                    <div class="aspect-[2/3] mb-4 rounded-lg overflow-hidden bg-slate-100 relative">
                      {book.coverUrl ? (
                         <img 
                           src={book.coverUrl} 
                           alt={book.title} 
                           width={200} 
                           height={300}
                           class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                         />
                      ) : (
                        <div class="flex items-center justify-center h-full text-slate-300">No Image</div>
                      )}
                    </div>
                    <h3 class="font-bold text-slate-900 mb-2 line-clamp-2 leading-tight">{book.title}</h3>
                    <div class="mt-auto flex justify-between items-center">
                      <span class="text-blue-600 font-bold">${(book.price / 100).toFixed(2)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}

        {books.length === 0 && (
           <div class="text-center py-20">
             <p class="text-slate-500">No books found. Is the backend running?</p>
           </div>
        )}
      </div>
    </div>
  );
});