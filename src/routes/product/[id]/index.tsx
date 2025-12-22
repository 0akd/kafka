import { component$ } from '@builder.io/qwik';
import { routeLoader$, Link } from '@builder.io/qwik-city';

// --- LOADER: FETCH BOOK DETAILS ---
export const useBookDetail = routeLoader$(async ({ params, status }) => {
  const rawBackendUrl = import.meta.env.PUBLIC_BACKEND_URL;

  if (!rawBackendUrl) {
    throw new Error('PUBLIC_BACKEND_URL is not defined');
  }

  const backendUrl = rawBackendUrl.replace(/\/+$/, '');
  const bookId = Number(params.id);

  if (!Number.isInteger(bookId)) {
    status(404);
    return null;
  }

  // Cold-start buffer
  await new Promise((r) => setTimeout(r, 1500));

  const url = `${backendUrl}/api/books/${bookId}`;
  console.log('Fetching book detail from:', url);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Book detail fetch failed (network):', err);
    status(502);
    return null;
  }

  if (!res.ok) {
    status(res.status === 404 ? 404 : 500);
    return null;
  }

  const jsonResponse = await res.json();
  
  // Handle Data Wrapper
  let bookData = jsonResponse.data || jsonResponse;
  if (Array.isArray(bookData)) {
    bookData = bookData[0];
  }

  if (!bookData) {
    status(404);
    return null;
  }

  // Debugging: Console me check karo backend kya bhej raha hai
  console.log("Backend Response Keys:", Object.keys(bookData));

  // 👇 FIX: Check both camelCase (Drizzle) and snake_case (Raw SQL)
  return {
    id: bookData.id,
    title: bookData.title,
    subtitle: bookData.subtitle,
    price: bookData.price,
    currency: bookData.currency,
    
    // Fix Image
    coverUrl: bookData.coverUrl || bookData.cover_url, 
    
    category: bookData.category,
    
    // ✅ FIX PDF: Check both keys
    pdfUrl: bookData.pdfUrl || bookData.pdf_url      
  };
});

// --- COMPONENT ---
export default component$(() => {
  const bookSignal = useBookDetail();

  // 404 UI
  if (!bookSignal.value) {
    return (
      <div class="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <h1 class="text-4xl font-bold text-slate-900 mb-4">Book Not Found</h1>
        <Link href="/" class="text-blue-600 hover:underline">← Go back home</Link>
      </div>
    );
  }

  return (
    <div class="min-h-screen bg-slate-50 font-sans py-12 px-6">
      <div class="max-w-5xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
        
        {/* Back Link */}
        <div class="p-6 pb-0">
          <Link href="/" class="inline-flex items-center text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">
            ← Back to Store
          </Link>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-10 p-8 md:p-12">
          
          {/* LEFT: IMAGE */}
          <div class="bg-slate-100 rounded-xl overflow-hidden shadow-inner flex items-center justify-center p-6 h-[500px]">
            <img 
              src={bookSignal.value.coverUrl} 
              alt={bookSignal.value.title} 
              referrerPolicy="no-referrer"
              width={350}
              height={500}
              class="max-h-full object-contain shadow-2xl rounded-md hover:scale-105 transition-transform duration-500"
            />
          </div>

          {/* RIGHT: INFO */}
          <div class="flex flex-col justify-center">
            
            <span class="inline-block bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider w-fit mb-4">
              {bookSignal.value.category}
            </span>

            <h1 class="text-4xl md:text-5xl font-bold text-slate-900 leading-tight mb-2">
              {bookSignal.value.title}
            </h1>
            
            {bookSignal.value.subtitle && (
              <p class="text-xl text-slate-500 mb-6">{bookSignal.value.subtitle}</p>
            )}

            <div class="h-px bg-slate-100 w-full my-6"></div>

            <div class="flex items-end gap-4 mb-8">
              <span class="text-4xl font-bold text-slate-900">
                ${(bookSignal.value.price / 100).toFixed(2)}
              </span>
              <span class="text-sm text-slate-400 font-medium mb-2">USD</span>
            </div>

            {/* ACTION BUTTONS */}
            <div class="space-y-4">
              <button class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg py-4 rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-95">
                Add to Cart
              </button>
              
              <div class="flex gap-4">
                
                {/* 👇 PDF BUTTON: Ab ye dikhna chahiye */}
                {bookSignal.value.pdfUrl && (
                  <Link 
                    href={`/read/${bookSignal.value.id}`} 
                    class="flex-1 bg-indigo-50 border-2 border-indigo-100 text-indigo-700 font-bold py-3 rounded-xl hover:bg-indigo-100 hover:border-indigo-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <span>📖 Read Online</span>
                  </Link>
                )}

                <button class="flex-1 bg-white border-2 border-slate-200 text-slate-700 font-bold py-3 rounded-xl hover:border-slate-300 transition-colors">
                  Share
                </button>
              </div>
            </div>

            <div class="mt-8 flex items-center gap-6 text-xs font-bold text-slate-400">
              <span class="flex items-center gap-2">✅ In Stock</span>
              <span class="flex items-center gap-2">🚀 Instant Delivery</span>
              <span class="flex items-center gap-2">🛡️ Secure Payment</span>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
});