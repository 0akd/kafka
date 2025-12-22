// src/routes/reader/[id]/index.tsx

import { component$, useSignal, useVisibleTask$, noSerialize, useStore, $ } from '@builder.io/qwik';
import { routeLoader$, routeAction$, Link, Form } from '@builder.io/qwik-city';
// Note: Agar aapne pdfjs-dist install nahi kiya hai toh: npm install pdfjs-dist
// import type { PDFDocumentProxy } from 'pdfjs-dist'; // Optional for types

// --- BACKEND LOGIC (Loaders/Actions) ---

export const useSavePage = routeAction$(async (data, { cookie, fail }) => {
  const backendUrl = import.meta.env.PUBLIC_BACKEND_URL;
  const userCookie = cookie.get('user_session');
  if (!userCookie?.value) return fail(401, { message: 'Login required' });
  
  const user = JSON.parse(userCookie.value);

  const payload = { userId: user.id, bookId: Number(data.bookId), page: Number(data.page) };
  try {
    await fetch(`${backendUrl}/api/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { success: true };
  } catch (err) {
    return fail(500, { message: 'Failed to save' });
  }
});

export const useReaderData = routeLoader$(async ({ params, status, cookie }) => {
  const backendUrl = import.meta.env.PUBLIC_BACKEND_URL?.replace(/\/+$/, '');
  const bookId = Number(params.id);

  let bookData = null;
  try {
    // Apne external backend se book info la rahe hain
    const res = await fetch(`${backendUrl}/api/books/${bookId}`);
    if (!res.ok) throw new Error();
    const json = await res.json();
    bookData = Array.isArray(json.data || json) ? (json.data || json)[0] : (json.data || json);
  } catch {
    status(404); return null;
  }

  const originalPdfUrl = bookData?.pdfUrl || bookData?.pdf_url;
  if (!originalPdfUrl) return { error: 'No PDF available' };

  // IMPORTANT: Yeh URL ab Step 1 wali file ko hit karega
const proxyUrl = `${backendUrl}/api/proxy-pdf?url=${encodeURIComponent(originalPdfUrl)}`;

  let savedPage = 1;
  const userCookie = cookie.get('user_session');
  if (userCookie?.value) {
    const user = JSON.parse(userCookie.value);
    try {
      const pRes = await fetch(`${backendUrl}/api/progress?userId=${user.id}&bookId=${bookId}`);
      if (pRes.ok) savedPage = (await pRes.json()).page || 1;
    } catch {}
  }

  return { id: bookData.id, pdfUrl: proxyUrl, title: bookData.title, initialPage: savedPage };
});

// --- UI COMPONENT ---
export default component$(() => {
  const bookSignal = useReaderData();
  const saveAction = useSavePage();
  
  const currentPage = useSignal(bookSignal.value?.initialPage || 1);
  const totalPages = useSignal(0);
  const isLoading = useSignal(true);
  const loadError = useSignal<string>('');
  
  const canvasRef = useSignal<HTMLCanvasElement>();
  const containerRef = useSignal<HTMLDivElement>();
  
  // PDF State store
  const pdfState = useStore<{ doc: any }>({ doc: undefined });

  // Render Logic
  const renderPage = $(async (num: number) => {
    if (!pdfState.doc || !canvasRef.value || !containerRef.value) return;

    try {
        const page = await pdfState.doc.getPage(num);
        
        // Responsive scaling logic
        const containerWidth = containerRef.value.clientWidth;
        const unscaledViewport = page.getViewport({ scale: 1 });
        const scale = (containerWidth - 40) / unscaledViewport.width; 
        
        const viewport = page.getViewport({ scale: scale < 0.5 ? 0.5 : scale });

        const canvas = canvasRef.value;
        const context = canvas.getContext('2d');

        if (context) {
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
                canvasContext: context,
                viewport: viewport,
            }).promise;
        }
    } catch (e) {
        console.error("Render Error:", e);
    }
  });

  // Page Change Logic
  const changePage = $((newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages.value) {
        currentPage.value = newPage;
        renderPage(newPage);
    }
  });

  useVisibleTask$(async () => {
    if (!bookSignal.value?.pdfUrl || bookSignal.value.error) {
        loadError.value = bookSignal.value?.error || "No PDF URL found";
        isLoading.value = false;
        return;
    }

    try {
      const pdfjs = await import('pdfjs-dist');
      // Make sure this file exists in your public folder!
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

      const loadingTask = pdfjs.getDocument(bookSignal.value.pdfUrl);
      const pdf = await loadingTask.promise;
      
      pdfState.doc = noSerialize(pdf);
      totalPages.value = pdf.numPages;
      
      await renderPage(currentPage.value);
      isLoading.value = false;

    } catch (error: any) {
      console.error("PDF Init Error:", error);
      loadError.value = "Failed to load PDF. Check Proxy or URL.";
      isLoading.value = false;
    }
  });

  if (loadError.value) {
      return (
          <div class="h-screen flex items-center justify-center bg-slate-900 text-red-400">
             <div class="text-center">
                <p class="mb-4">Error: {loadError.value}</p>
                <Link href="/" class="underline text-white">Back Home</Link>
             </div>
          </div>
      );
  }

  return (
    <div class="h-[100dvh] flex flex-col bg-slate-900 overflow-hidden">
      
      {/* HEADER */}
      <div class="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-3 shrink-0 z-10">
        <div class="flex items-center gap-3">
            <Link href="/" class="text-white text-lg">⬅</Link>
            <div>
                 <h2 class="text-white font-bold truncate max-w-[120px] text-sm">{bookSignal.value?.title}</h2>
                 <p class="text-[10px] text-slate-400">Page {currentPage.value} of {totalPages.value}</p>
            </div>
        </div>

        <div class="flex items-center gap-2">
            <button onClick$={() => changePage(currentPage.value - 1)} disabled={currentPage.value <= 1} class="p-2 bg-slate-700 rounded text-white disabled:opacity-50">⬅</button>
            
            <Form action={saveAction}>
                <input type="hidden" name="bookId" value={bookSignal.value?.id} />
                <input type="hidden" name="page" value={currentPage.value} />
                <button type="submit" class="bg-blue-600 px-3 py-1.5 rounded text-white text-xs font-bold">Save</button>
            </Form>
            
            <button onClick$={() => changePage(currentPage.value + 1)} disabled={currentPage.value >= totalPages.value} class="p-2 bg-slate-700 rounded text-white disabled:opacity-50">➡</button>
        </div>
      </div>

      <div ref={containerRef} class="flex-grow w-full bg-slate-600 overflow-auto flex justify-center p-2 relative">
        {isLoading.value && (
             <div class="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 z-20 text-white">
                 <div class="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                 Loading...
             </div>
        )}
        <canvas ref={canvasRef} class="shadow-2xl bg-white block" />
      </div>
    </div>
  );
});