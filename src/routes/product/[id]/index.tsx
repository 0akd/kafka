import { component$ } from '@builder.io/qwik';
import { routeLoader$, Link } from '@builder.io/qwik-city';
import { eq } from 'drizzle-orm';
import { db } from '~/db';
import { books } from '~/db/schema';

export const useBookDetail = routeLoader$(async ({ params, status }) => {
  const bookId = Number(params.id);
  const book = await db.select().from(books).where(eq(books.id, bookId)).get();

  if (!book) {
    status(404);
    return null;
  }
  return book;
});

export default component$(() => {
  // 1. Get the signal, but DO NOT destructure .value into a variable here!
  const bookSignal = useBookDetail();

  // 2. Check the signal value directly
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
        
        <div class="p-6 pb-0">
          <Link href="/" class="inline-flex items-center text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">
            ← Back to Store
          </Link>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-10 p-8 md:p-12">
          
          <div class="bg-slate-100 rounded-xl overflow-hidden shadow-inner flex items-center justify-center p-6 h-[500px]">
            {/* 3. Use bookSignal.value directly in the JSX tags */}
            <img 
              src={bookSignal.value.coverUrl} 
              alt={bookSignal.value.title} 
              class="max-h-full object-contain shadow-2xl rounded-md hover:scale-105 transition-transform duration-500"
            />
          </div>

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

 <div class="space-y-4">
              <button class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg py-4 rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-95">
                Add to Cart
              </button>
              
              <div class="flex gap-4">
                
                {/* --- NEW: READ ONLINE BUTTON --- */}
                {/* Only shows if pdfUrl exists in database */}
                {bookSignal.value.pdfUrl && (
                  <Link 
                    href={`/read/${bookSignal.value.id}`}
                    target="_blank" // Opens in new tab
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