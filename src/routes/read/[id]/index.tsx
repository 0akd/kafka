import { component$, useSignal } from '@builder.io/qwik';
import { routeLoader$, routeAction$, Link, Form } from '@builder.io/qwik-city';

// --- ACTION: SAVE PAGE (Call Backend API) ---
export const useSavePage = routeAction$(async (data, { cookie, fail }) => {
  const backendUrl = import.meta.env.PUBLIC_BACKEND_URL;
  
  // 1. Get User from Cookie
  const userCookie = cookie.get('user_session');
  if (!userCookie?.value) return fail(401, { message: 'Login required' });
  const user = JSON.parse(userCookie.value);

  // 2. Prepare Data
  const payload = {
    userId: user.id,
    bookId: Number(data.bookId),
    page: Number(data.page)
  };

  // 3. Call Backend API
  try {
    const res = await fetch(`${backendUrl}/api/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error('API Failed');
    
    return { success: true, savedPage: payload.page };
  } catch (err) {
    console.error('Save Action Error:', err);
    return fail(500, { message: 'Failed to save' });
  }
});

// --- LOADER: FETCH PDF & PROGRESS ---
export const useReaderData = routeLoader$(async ({ params, status, cookie }) => {
  const rawBackendUrl = import.meta.env.PUBLIC_BACKEND_URL;
  const backendUrl = rawBackendUrl.replace(/\/+$/, '');
  const bookId = Number(params.id);

  // 1. Fetch Book Details (PDF URL)
  let bookData = null;
  try {
    const res = await fetch(`${backendUrl}/api/books/${bookId}`);
    if (!res.ok) {
      status(404);
      return null;
    }
    const json = await res.json();
    let data = json.data || json;
    if (Array.isArray(data)) data = data[0];
    bookData = data;
  } catch (err) {
    status(500);
    return null;
  }

  const pdfUrl = bookData.pdfUrl || bookData.pdf_url;
  if (!pdfUrl) return { error: 'No PDF available' };

  // 2. Fetch User's Last Saved Page (via API)
  let savedPage = 1;
  const userCookie = cookie.get('user_session');
  
  if (userCookie?.value) {
    const user = JSON.parse(userCookie.value);
    try {
      // Call our new API endpoint
      const progressRes = await fetch(`${backendUrl}/api/progress?userId=${user.id}&bookId=${bookId}`);
      if (progressRes.ok) {
        const progressJson = await progressRes.json();
        savedPage = progressJson.page || 1;
      }
    } catch (e) {
      console.error('Progress fetch failed', e);
    }
  }

  return { 
    id: bookData.id,
    pdfUrl, 
    title: bookData.title,
    initialPage: savedPage 
  };
});

// --- UI COMPONENT ---
export default component$(() => {
  const bookSignal = useReaderData();
  const saveAction = useSavePage();

  // Initialize page number from Loader data
  const currentPage = useSignal(bookSignal.value?.initialPage || 1);

  if (!bookSignal.value || bookSignal.value.error) {
    return (
      <div class="h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
        <h1 class="text-2xl font-bold mb-4">PDF Not Available 😢</h1>
        <Link href="/" class="text-blue-400 hover:underline">Go Back Home</Link>
      </div>
    );
  }

  // URL Append Logic: adds #page=X
  const pdfSrcWithPage = `${bookSignal.value.pdfUrl}#page=${currentPage.value}`;

  return (
    <div class="h-screen flex flex-col bg-slate-900 overflow-hidden">
      
      {/* Header Bar */}
      <div class="h-16 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4 shadow-md z-10 gap-4">
        
        <h2 class="text-white font-bold truncate hidden md:block max-w-xs">
          📖 {bookSignal.value.title}
        </h2>

        {/* --- CONTROLS --- */}
        <div class="flex items-center gap-2">
            <Form action={saveAction} class="flex items-center gap-2 bg-slate-700 p-1 rounded-lg border border-slate-600">
                <input type="hidden" name="bookId" value={bookSignal.value.id} />
                
                <span class="text-slate-400 text-xs font-bold pl-2">Pg:</span>
                
                <input 
                    type="number" 
                    name="page"
                    min="1"
                    value={currentPage.value}
                    onInput$={(e) => currentPage.value = Number((e.target as HTMLInputElement).value)}
                    class="w-16 bg-slate-900 text-white text-center text-sm font-bold border border-slate-600 rounded focus:outline-none focus:border-blue-500 py-1"
                />

                <button 
                    type="submit"
                    class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors"
                >
                   {saveAction.isRunning ? 'Saving...' : 'Go & Save'}
                </button>
            </Form>
            
            {saveAction.value?.success && (
                <span class="text-green-400 text-xs font-bold animate-pulse">Saved!</span>
            )}
        </div>

        <Link href="/" class="text-xs font-bold text-slate-300 bg-slate-700 px-3 py-1.5 rounded hover:bg-slate-600 transition-colors">
          ❌ Close
        </Link>
      </div>

      {/* PDF Viewer */}
      <div class="flex-grow w-full h-full relative bg-slate-200">
        <iframe
          // Key change hone par iframe reload hoga aur sahi page par jump karega
          key={currentPage.value}
          src={pdfSrcWithPage}
          class="w-full h-full border-0"
          referrerPolicy="no-referrer"
          title="PDF Viewer"
        />
      </div>
      
    </div>
  );
});