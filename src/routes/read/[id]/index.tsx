import { component$, useSignal, useVisibleTask$, $ } from '@builder.io/qwik';
import { routeLoader$, Link } from '@builder.io/qwik-city';
import { eq } from 'drizzle-orm';
import { db } from '~/db';
import { books } from '~/db/schema';

export const useBookPdf = routeLoader$(async ({ params, status }) => {
  const bookId = Number(params.id);
  const book = await db.select().from(books).where(eq(books.id, bookId)).get();

  if (!book || !book.pdfUrl) {
    status(404);
    return null;
  }
  return book;
});

export default component$(() => {
  const bookSignal = useBookPdf();
  
  const currentPage = useSignal<number>(1);
  const iframeSrc = useSignal<string>('');
  const isLoaded = useSignal(false);
  
  // New signal to track "Saved" state
  const isSaved = useSignal(false);

// eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    track(() => bookSignal.value);
    if (bookSignal.value) {
      const bookId = bookSignal.value.id;
      const savedPage = localStorage.getItem(`book_progress_${bookId}`);
      
      if (savedPage) {
        currentPage.value = Number(savedPage);
        iframeSrc.value = `${bookSignal.value.pdfUrl}#page=${savedPage}`;
      } else {
        iframeSrc.value = `${bookSignal.value.pdfUrl}#page=1`;
      }
      isLoaded.value = true;
    }
  });

  const saveProgress = $(() => {
    if (bookSignal.value) {
      localStorage.setItem(`book_progress_${bookSignal.value.id}`, String(currentPage.value));
      iframeSrc.value = `${bookSignal.value.pdfUrl}#page=${currentPage.value}`;
      
      // 1. Show "Saved!" state
      isSaved.value = true;

      // 2. Remove "Saved!" state after 2 seconds
      setTimeout(() => {
        isSaved.value = false;
      }, 2000);
    }
  });

  if (!bookSignal.value) {
    return <div class="p-10 text-white">Book not found</div>;
  }

  return (
    <div class="h-screen flex flex-col bg-slate-900">
      
      <div class="h-16 bg-slate-800 border-b border-slate-700 flex items-center px-4 justify-between shrink-0 shadow-md z-10">
        
        <div class="flex items-center gap-4 overflow-hidden">
          <Link 
            href={`/product/${bookSignal.value.id}`}
            class="text-slate-400 hover:text-white transition-colors font-bold text-sm flex items-center gap-1"
          >
            <span>← Exit</span>
          </Link>
          <div class="h-4 w-px bg-slate-600"></div>
          <span class="text-white font-bold truncate hidden md:block">
            {bookSignal.value.title}
          </span>
        </div>

        <div class="flex items-center gap-2 bg-slate-900 p-1.5 rounded-lg border border-slate-700">
          <span class="text-slate-400 text-xs font-bold uppercase hidden sm:block px-2">Page:</span>
          
          <input 
            type="number" 
            min="1"
            value={currentPage.value}
            onInput$={(e) => currentPage.value = Number((e.target as HTMLInputElement).value)}
            class="w-16 bg-slate-800 text-white border border-slate-600 rounded px-2 py-1 text-center font-mono text-sm focus:border-blue-500 outline-none"
          />
          
          <button 
            onClick$={saveProgress}
            // Change color based on isSaved state
            class={`
              text-white text-xs font-bold px-3 py-1.5 rounded transition-all flex items-center gap-1 w-20 justify-center
              ${isSaved.value ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}
            `}
          >
            {/* Change text based on isSaved state */}
            <span>{isSaved.value ? '✅ Saved' : '💾 Save'}</span>
          </button>
        </div>

      </div>

      <div class="flex-grow w-full bg-slate-800 relative">
        {isLoaded.value ? (
          <iframe 
            key={iframeSrc.value} 
            src={iframeSrc.value} 
            class="w-full h-full border-0 absolute inset-0"
            title="PDF Viewer"
          />
        ) : (
          <div class="flex items-center justify-center h-full text-slate-500">
            Loading your progress...
          </div>
        )}
      </div>
    </div>
  );
});