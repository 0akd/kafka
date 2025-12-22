import { component$, useSignal, useVisibleTask$, noSerialize, useStore, $ } from '@builder.io/qwik';
import { routeLoader$, routeAction$, Link, Form } from '@builder.io/qwik-city';
// import type { PDFDocumentProxy } from 'pdfjs-dist'; // Optional

// --- BACKEND LOGIC (Same as before) ---

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
    const res = await fetch(`${backendUrl}/api/books/${bookId}`);
    if (!res.ok) throw new Error();
    const json = await res.json();
    bookData = Array.isArray(json.data || json) ? (json.data || json)[0] : (json.data || json);
  } catch {
    status(404); return null;
  }

  const originalPdfUrl = bookData?.pdfUrl || bookData?.pdf_url;
  if (!originalPdfUrl) return { error: 'No PDF available' };

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
  
  // Zoom State
  const currentZoom = useSignal(1); // 1 = 100% zoom
  const touchStartDist = useSignal(0);
  const startZoom = useSignal(1);
  
  // PDF State store
  const pdfState = useStore<{ doc: any }>({ doc: undefined });

  // --- RENDER LOGIC ---
  const renderPage = $(async (num: number) => {
    if (!pdfState.doc || !canvasRef.value || !containerRef.value) return;

    try {
        const page = await pdfState.doc.getPage(num);
        
        // 1. Container ki width nikalo
        const containerWidth = containerRef.value.clientWidth;
        
        // 2. High Resolution Render Setup
        // Mobile par pixels sharp dikhane ke liye pixel ratio use karte hain
        const pixelRatio = window.devicePixelRatio || 1;
        
        // Unscaled viewport se width nikalo
        const unscaledViewport = page.getViewport({ scale: 1 });
        
        // Fit-to-width scale calculation (minus padding)
        const displayScale = (containerWidth - 20) / unscaledViewport.width; 
        
        // Render scale ko pixelRatio se multiply karo for sharpness
        const outputScale = displayScale * pixelRatio;

        const viewport = page.getViewport({ scale: outputScale });

        const canvas = canvasRef.value;
        const context = canvas.getContext('2d');

        if (context) {
            // Canvas ke internal pixels high res honge
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);

            // Lekin CSS width/height fit-to-screen rahegi
            canvas.style.width = `${Math.floor(viewport.width / pixelRatio)}px`;
            canvas.style.height = `${Math.floor(viewport.height / pixelRatio)}px`;

            // Transform reset karo naye page par
            currentZoom.value = 1;
            canvas.style.transform = `scale(1)`;
            canvas.style.transformOrigin = `top center`;

            await page.render({
                canvasContext: context,
                viewport: viewport,
            }).promise;
        }
    } catch (e) {
        console.error("Render Error:", e);
    }
  });

  const changePage = $((newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages.value) {
        currentPage.value = newPage;
        renderPage(newPage);
    }
  });

  // --- TOUCH HANDLERS (PINCH TO ZOOM) ---
  const handleTouchStart = $((e: TouchEvent) => {
    if (e.touches.length === 2) {
      // Do ungliyan hain, pinch shuru
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      // Pythagoras theorem to find distance between fingers
      const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
      touchStartDist.value = dist;
      startZoom.value = currentZoom.value;
    }
  });

  const handleTouchMove = $((e: TouchEvent) => {
    if (e.touches.length === 2) {
      // Default scroll rokne ke liye (optional, behavior depend karta hai)
      e.preventDefault(); 

      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
      
      if (touchStartDist.value > 0) {
        // New zoom = Old Zoom * (New Dist / Old Dist)
        const zoomChange = dist / touchStartDist.value;
        let newZoom = startZoom.value * zoomChange;

        // Limits set karo: Min 0.5x (small), Max 4x (large)
        if (newZoom < 0.5) newZoom = 0.5;
        if (newZoom > 4) newZoom = 4;

        currentZoom.value = newZoom;
        
        // CSS transform apply karo turant smooth experience ke liye
        if (canvasRef.value) {
            canvasRef.value.style.transform = `scale(${newZoom})`;
            // Zoom out hone par center me rahe, zoom in par left align ho sakta hai
            canvasRef.value.style.transformOrigin = newZoom < 1 ? 'center top' : 'center top'; 
        }
      }
    }
  });

  const handleTouchEnd = $(() => {
    touchStartDist.value = 0;
  });

  // --- INITIAL LOAD ---
  useVisibleTask$(async () => {
    if (!bookSignal.value?.pdfUrl || bookSignal.value.error) {
        loadError.value = bookSignal.value?.error || "No PDF URL found";
        isLoading.value = false;
        return;
    }

    try {
      const pdfjs = await import('pdfjs-dist');
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

  // Add event listeners directly to container
  useVisibleTask$(({ cleanup }) => {
    const el = containerRef.value;
    if (!el) return;

    // Passive false is important to allow e.preventDefault()
    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);

    cleanup(() => {
        el.removeEventListener('touchstart', handleTouchStart);
        el.removeEventListener('touchmove', handleTouchMove);
        el.removeEventListener('touchend', handleTouchEnd);
    });
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
      <div class="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-3 shrink-0 z-20 shadow-md">
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

      {/* READER CONTAINER */}
      <div 
        ref={containerRef} 
        class="flex-grow w-full bg-slate-600 overflow-auto flex justify-center p-2 relative touch-pan-x touch-pan-y"
        style={{
             // Smooth transitions for zoom, but not during active pinch (handled in JS)
             touchAction: 'none' // Important to handle pinch manually without browser interference
        }}
      >
        {isLoading.value && (
             <div class="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 z-20 text-white">
                 <div class="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                 Loading...
             </div>
        )}
        
        {/* CANVAS WRAPPER (To maintain layout during scale) */}
        <div style={{
            transition: 'transform 0.1s ease-out', // Thoda smooth effect
            width: 'fit-content',
            height: 'fit-content'
        }}>
             <canvas ref={canvasRef} class="shadow-2xl bg-white block origin-top" />
        </div>
        
      </div>
      
      {/* ZOOM INDICATOR (Optional Overlay) */}
      {currentZoom.value !== 1 && (
          <div class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-2 py-1 rounded text-xs pointer-events-none z-30">
              {Math.round(currentZoom.value * 100)}%
          </div>
      )}
    </div>
  );
});