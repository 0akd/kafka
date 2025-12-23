import { component$, useVisibleTask$ } from '@builder.io/qwik';
import { routeLoader$, Form, Link } from '@builder.io/qwik-city';
import { useLoginAction, useLogoutAction, useUserLoader } from './layout';
import { Header } from '../components/header'; // 👈 Import karein

export const useBooksLoader = routeLoader$(async () => {
  const backendUrl = import.meta.env.PUBLIC_BACKEND_URL;

  // Artificial delay
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const url = `${backendUrl}/api/books`;
  console.log('Fetching books from:', url);

  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch books (${res.status})`);
  }

  const jsonResponse = await res.json();
  const rawData = jsonResponse.data || [];
  
  // Debugging: Terminal mein check karein ki data kaisa dikh raha hai
  if (rawData.length > 0) {
    console.log('Sample Book Data:', rawData[0]);
  }

  // 👇 FIX: Backend agar 'coverUrl' bhej raha hai toh usse use karein
  return rawData.map((book: any) => ({
    id: book.id,
    title: book.title,
    subtitle: book.subtitle,
    price: book.price,
    currency: book.currency,
    
    // ✅ YAHAN CHANGE HAI: Dono keys check karein
    coverUrl: book.coverUrl || book.cover_url, 
    
    category: book.category,
    
    // ✅ PDF ke liye bhi same fix
    pdfUrl: book.pdfUrl || book.pdf_url      
  }));
});


export default component$(() => {
  const user = useUserLoader();
  const loginAction = useLoginAction();
  const logoutAction = useLogoutAction();
  const booksSignal = useBooksLoader();

  // Google Login Script logic remains here
  useVisibleTask$(({ track }) => {
    track(() => user.value);
    // ... (Existing script loading logic)
  });

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
      
      {/* Naya Header Component yahan use karein */}
      <Header user={user.value} logoutAction={logoutAction} />

      {/* Hidden Login Form (Google callback needs this) */}
      <Form action={loginAction} class="hidden">
        <input type="hidden" name="credential" id="google-token-input" />
        <button type="submit" id="google-submit-btn">Login</button>
      </Form>

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
                  <div class="bg-white p-4 rounded-xl shadow-sm group-hover:shadow-xl border h-full flex flex-col">
                    <div class="aspect-[2/3] mb-4 rounded-lg overflow-hidden bg-slate-100">
                      <img src={book.coverUrl} alt={book.title} class="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                    </div>
                    <h3 class="font-bold text-slate-900 mb-2 line-clamp-2">{book.title}</h3>
                    <div class="mt-auto flex justify-between items-center">
                      <span class="text-slate-500 font-medium">${(book.price / 100).toFixed(2)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});