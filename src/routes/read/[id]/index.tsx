import { 
  component$, 
  useSignal, 
  useVisibleTask$, 
  useStore,
  noSerialize, 
  $
} from '@builder.io/qwik';
import { routeLoader$, routeAction$ } from '@builder.io/qwik-city';
import type { NoSerialize } from '@builder.io/qwik';

// --- BACKEND LOGIC ---
export const useSavePage = routeAction$(async (data, { cookie, fail }) => {
  const backendUrl = import.meta.env.PUBLIC_BACKEND_URL;
  const userCookie = cookie.get('user_session');
  if (!userCookie?.value) return fail(401, { message: 'Login required' });
  const user = JSON.parse(userCookie.value);
  const page = Number(data.page);
  
  try {
    await fetch(`${backendUrl}/api/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, bookId: Number(data.bookId), page }),
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

// --- SUB-COMPONENT: PDF Page ---
export const PDFPage = component$(({ pageNum, doc, onInView, width }: any) => {
  const canvasRef = useSignal<HTMLCanvasElement>();
  const containerRef = useSignal<HTMLDivElement>();
  const isRendered = useSignal(false);

  const render = $(async () => {
    if (!doc || !canvasRef.value || !width || width <= 0) return;
    
    try {
      const page = await doc.getPage(pageNum);
      const pixelRatio = window.devicePixelRatio || 1;
      const unscaledViewport = page.getViewport({ scale: 1 });
      const scale = width / unscaledViewport.width;
      const viewport = page.getViewport({ scale: scale * pixelRatio });

      const canvas = canvasRef.value;
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = '100%'; 
        canvas.style.height = 'auto';
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        isRendered.value = true;
      }
    } catch (e) { console.warn(e); }
  });

  useVisibleTask$(({ track }) => {
    track(() => width);
    const t = setTimeout(() => {
        if(isRendered.value) requestAnimationFrame(() => render());
    }, 100);
    return () => clearTimeout(t);
  });

  useVisibleTask$(({ cleanup }) => {
    if (!containerRef.value) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
            render();
            if (entry.intersectionRatio > 0.5) onInView(pageNum);
        }
      });
    }, { threshold: [0.1, 0.5] });
    observer.observe(containerRef.value);
    cleanup(() => observer.disconnect());
  });

  return (
    <div ref={containerRef} class="w-full flex justify-center bg-slate-500 my-2" style={{ minHeight: '300px' }}>
      <canvas ref={canvasRef} class="bg-white block shadow-lg" />
    </div>
  );
});

// --- MAIN COMPONENT ---
export default component$(() => {
  const bookSignal = useReaderData();
  const saveAction = useSavePage();
  
  const currentPage = useSignal(Math.max(1, bookSignal.value?.initialPage || 1));
  const totalPages = useSignal(0);
  const isLoading = useSignal(true);
  const pdfDoc = useSignal<NoSerialize<any>>();
  const containerWidth = useSignal(0);
  const mainContainerRef = useSignal<HTMLDivElement>();

  const zoomState = useStore({
    scale: 1.0,     
    baseScale: 1.0, 
    startDist: 0
  });

  // --- CENTER-ANCHORED ZOOM LOGIC ---
  const updateZoom = $((newScale: number, centerX?: number, centerY?: number) => {
     // 1. Clamp Scale (0.5x to 3.0x)
     const clampedScale = Math.min(Math.max(newScale, 0.5), 3.0);
     
     // Optimization: Don't do heavy math if scale hasn't effectively changed
     if (Math.abs(clampedScale - zoomState.scale) < 0.01) return;

     const el = mainContainerRef.value;
     if (!el) return;

     const oldScale = zoomState.scale;
     const ratio = clampedScale / oldScale;

     // 2. Determine Anchor Point (Where are we zooming into?)
     // If centerX/Y are provided (Pinch), use those.
     // If not (Slider), use the exact center of the current viewport.
     const rect = el.getBoundingClientRect();
     const viewportCX = centerX !== undefined ? (centerX - rect.left) : (rect.width / 2);
     const viewportCY = centerY !== undefined ? (centerY - rect.top) : (rect.height / 2);

     // 3. Calculate Point in Document Space
     // "Where is this point in the scrollable document right now?"
     const docX = el.scrollLeft + viewportCX;
     const docY = el.scrollTop + viewportCY;

     // 4. Update State (Trigger Reactivity)
     zoomState.scale = clampedScale;

     // 5. Adjust Scroll Position
     // The point (docX, docY) will move to (docX * ratio, docY * ratio) after the width change.
     // We subtract viewportCX/Y to bring that point back to the same spot on the screen.
     requestAnimationFrame(() => {
        el.scrollLeft = (docX * ratio) - viewportCX;
        el.scrollTop = (docY * ratio) - viewportCY;
     });
  });

  const handleTouchStart = $((e: TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      zoomState.startDist = dist;
      zoomState.baseScale = zoomState.scale;
    }
  });

  const handleTouchMove = $((e: TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault(); 
      
      const t1 = e.touches[0];
      const t2 = e.touches[1];

      // Calculate Distance
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      
      // Calculate Center Point of the Pinch (The "free will" point)
      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;

      if (zoomState.startDist > 0) {
        const newScale = zoomState.baseScale * (dist / zoomState.startDist);
        // Pass the midpoint so we zoom into exactly where the fingers are
        updateZoom(newScale, midX, midY);
      }
    }
  });

  useVisibleTask$(async () => {
    if (!bookSignal.value?.pdfUrl) return;
    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      
      const loadingTask = pdfjs.getDocument({ url: bookSignal.value.pdfUrl });
      const pdf = await loadingTask.promise;
      pdfDoc.value = noSerialize(pdf);
      totalPages.value = pdf.numPages;
      
      setTimeout(() => {
        const initialPage = bookSignal.value?.initialPage ?? 1;
        if(initialPage > 1) {
             document.getElementById(`page-${initialPage}`)?.scrollIntoView({ behavior: 'auto', block: 'start' });
        }
      }, 500);
      isLoading.value = false;
    } catch { isLoading.value = false; }
  });

  useVisibleTask$(({ cleanup }) => {
    if (!mainContainerRef.value) return;
    containerWidth.value = mainContainerRef.value.clientWidth;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) containerWidth.value = entry.contentRect.width;
    });
    resizeObserver.observe(mainContainerRef.value);
    
    const el = mainContainerRef.value;
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    
    cleanup(() => {
        resizeObserver.disconnect();
        el.removeEventListener('touchstart', handleTouchStart);
        el.removeEventListener('touchmove', handleTouchMove);
    });
  });

  const handlePageVisible = $((num: number) => { 
    if (num >= 1) currentPage.value = num; 
  });

  return (
    <div class="h-[100dvh] flex flex-col bg-slate-900 overflow-hidden relative">
      
      {/* SCROLL CONTAINER */}
      <div 
        ref={mainContainerRef}
        // NOTE: removed 'scroll-smooth' to prevent fighting with the zoom math
        class="flex-grow w-full bg-slate-600 overflow-auto relative"
      >
        {isLoading.value && <div class="text-white text-center mt-10">Loading...</div>}
        
        {!isLoading.value && pdfDoc.value && containerWidth.value > 0 && (
            <div 
                style={{
                    width: `${zoomState.scale * 100}%`,
                    // NOTE: Removed transition on width to make scroll sync instant
                    margin: '0 auto', 
                    paddingBottom: '140px' 
                }}
            >
                {Array.from({ length: totalPages.value }, (_, i) => i + 1).map((num) => (
                    <div key={num} id={`page-${num}`} class="w-full">
                        <PDFPage 
                            pageNum={num} 
                            doc={pdfDoc.value} 
                            width={containerWidth.value * zoomState.scale} 
                            onInView={handlePageVisible} 
                        />
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* BOTTOM CONTROLS CONTAINER */}
      <div class="fixed bottom-0 left-0 w-full bg-slate-800 border-t border-slate-700 z-30 flex flex-col shadow-2xl pb-6">
        
        {/* ROW 1: FULL WIDTH SAVE BUTTON */}
        <button 
            onClick$={() => saveAction.submit({ bookId: bookSignal.value?.id, page: currentPage.value })}
            disabled={saveAction.isRunning}
            class={`
                w-full py-4 text-center font-bold text-lg uppercase tracking-wider
                transition active:bg-blue-700
                ${saveAction.isRunning ? 'bg-slate-700 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-500'}
            `}
        >
            {saveAction.isRunning ? 'Saving Progress...' : 'Save Current Page'}
        </button>

        {/* ROW 2: Zoom Slider */}
        <div class="flex items-center gap-4 px-4 py-4 bg-slate-900/50">
            <span class="text-slate-400 text-xs font-mono w-10 text-right">
                {Math.round(zoomState.scale * 100)}%
            </span>
            <input 
                type="range" 
                min="0.5" 
                max="3.0" 
                step="0.1"
                value={zoomState.scale}
                onInput$={(e) => {
                    const val = parseFloat((e.target as HTMLInputElement).value);
                    updateZoom(val); // This will default to center-screen zoom
                }}
                class="flex-grow h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <button 
                onClick$={() => updateZoom(1.0)} 
                class="text-xs text-slate-400 hover:text-white"
            >
                Reset
            </button>
        </div>

      </div>
    </div>
  );
});