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
  const bookId = Number(data.bookId);

  try {
    const res = await fetch(`${backendUrl}/api/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, bookId, page }),
    });
    if (!res.ok) return fail(res.status, { message: 'Backend refused save' });
    return { success: true };
  } catch (err) {
    return fail(500, { message: 'Network connection failed' });
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
  const isVisible = useSignal(false);

  const renderPage = $(async (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, renderTaskRef: any) => {
    try {
      const page = await doc.getPage(pageNum);
      const unscaledViewport = page.getViewport({ scale: 1 });
      const scale = width / unscaledViewport.width;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: scale * pixelRatio });

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = '100%';
      canvas.style.height = 'auto';

      if (renderTaskRef.current) renderTaskRef.current.cancel();

      const renderContext = { canvasContext: ctx, viewport: viewport };
      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;
      await renderTask.promise;
    } catch (e: any) {
      if (e.name !== 'RenderingCancelledException') console.warn('Render error:', e);
    }
  });

  useVisibleTask$(({ cleanup, track }) => {
    track(() => width);
    const renderTaskRef = { current: null as any };
    let activeTimeout: any = null;

    if (!containerRef.value) return;

    const renderObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
            isVisible.value = true;
            if (activeTimeout) clearTimeout(activeTimeout);
            activeTimeout = setTimeout(() => {
                if (canvasRef.value) {
                    const ctx = canvasRef.value.getContext('2d');
                    if (ctx) renderPage(ctx, canvasRef.value, renderTaskRef);
                }
            }, 100); 
        } else {
            isVisible.value = false;
            if (renderTaskRef.current) {
                renderTaskRef.current.cancel();
                renderTaskRef.current = null;
            }
        }
      });
    }, { rootMargin: '200px 0px', threshold: 0.01 });

    const trackingObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                onInView(pageNum);
            }
        });
    }, { rootMargin: '-50% 0px -50% 0px' });

    renderObserver.observe(containerRef.value);
    trackingObserver.observe(containerRef.value);

    cleanup(() => {
        renderObserver.disconnect();
        trackingObserver.disconnect();
        if (renderTaskRef.current) renderTaskRef.current.cancel();
        if (activeTimeout) clearTimeout(activeTimeout);
    });
  });

  return (
    <div 
      ref={containerRef} 
      class="w-full flex justify-center bg-slate-500 my-2 relative shadow-lg" 
      style={{ minHeight: `${width * 1.4}px` }} 
    >
      {isVisible.value && <canvas ref={canvasRef} class="bg-white block w-full h-auto" />}
      {!isVisible.value && (
          <div class="absolute inset-0 bg-white flex items-center justify-center text-slate-300 font-bold text-4xl select-none">
            {pageNum}
          </div>
      )}
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
  
  // PROGRESS STATE
  const loadProgress = useSignal(0);
  
  const pdfDoc = useSignal<NoSerialize<any>>();
  const containerWidth = useSignal(0);
  const mainContainerRef = useSignal<HTMLDivElement>();
  
  const showControls = useSignal(true);
  const manualPageInput = useSignal('');

  const zoomState = useStore({
    scale: 1.0,     
    baseScale: 1.0, 
    startDist: 0
  });

  // --- ACTIONS ---
  const jumpToPage = $((pageNum: number) => {
    if (pageNum < 1 || pageNum > totalPages.value) return;
    currentPage.value = pageNum;
    showControls.value = false;
    setTimeout(() => {
        const el = document.getElementById(`page-${pageNum}`);
        if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' }); 
    }, 10);
  });

  const updateZoom = $((newScale: number, centerX?: number, centerY?: number) => {
     const clampedScale = Math.min(Math.max(newScale, 0.5), 3.0);
     if (Math.abs(clampedScale - zoomState.scale) < 0.01) return;

     const el = mainContainerRef.value;
     if (!el) return;

     const oldScale = zoomState.scale;
     const ratio = clampedScale / oldScale;
     const rect = el.getBoundingClientRect();
     const viewportCX = centerX !== undefined ? (centerX - rect.left) : (rect.width / 2);
     const viewportCY = centerY !== undefined ? (centerY - rect.top) : (rect.height / 2);

     const docX = el.scrollLeft + viewportCX;
     const docY = el.scrollTop + viewportCY;

     zoomState.scale = clampedScale;

     requestAnimationFrame(() => {
        el.scrollLeft = (docX * ratio) - viewportCX;
        el.scrollTop = (docY * ratio) - viewportCY;
     });
  });

  const zoomIn = $(() => updateZoom(zoomState.scale + 0.2));
  const zoomOut = $(() => updateZoom(zoomState.scale - 0.2));

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
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;

      if (zoomState.startDist > 0) {
        const newScale = zoomState.baseScale * (dist / zoomState.startDist);
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
      
      // FIXED: Added type for progress parameter
      loadingTask.onProgress = (progress: { loaded: number; total: number }) => {
          if (progress.total > 0) {
              const percent = (progress.loaded / progress.total) * 100;
              loadProgress.value = Math.round(percent);
          }
      };

      const pdf = await loadingTask.promise;
      pdfDoc.value = noSerialize(pdf);
      totalPages.value = pdf.numPages;
      
      setTimeout(() => {
        const initialPage = bookSignal.value?.initialPage ?? 1;
        if(initialPage > 1) {
             const el = document.getElementById(`page-${initialPage}`);
             if(el) el.scrollIntoView({ behavior: 'auto', block: 'start' });
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

  const handleContainerClick = $(() => {
    showControls.value = !showControls.value;
  });

  return (
    <div class="h-[100dvh] flex flex-col bg-slate-900 overflow-hidden relative">
      
      {/* FLOATING PAGE INDICATOR */}
      {!isLoading.value && (
          <div class="fixed top-4 right-4 z-40 bg-black/50 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-mono shadow-lg pointer-events-none select-none border border-white/10">
              {currentPage.value} / {totalPages.value}
          </div>
      )}

      {/* SCROLL CONTAINER */}
      <div 
        ref={mainContainerRef}
        onClick$={handleContainerClick}
        class="flex-grow w-full bg-slate-600 overflow-auto relative cursor-pointer"
        style={{ willChange: 'scroll-position' }} 
      >
        {/* PROGRESS BAR LOADING SCREEN */}
        {isLoading.value && (
            <div class="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-50">
                <div class="w-64 bg-slate-700 rounded-full h-2.5 mb-4 overflow-hidden">
                    <div 
                        class="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                        style={{ width: `${loadProgress.value}%` }}
                    ></div>
                </div>
                <div class="text-white font-mono text-sm animate-pulse">
                    Downloading Book... {loadProgress.value}%
                </div>
            </div>
        )}
        
        {!isLoading.value && pdfDoc.value && containerWidth.value > 0 && (
            <div style={{ width: `${zoomState.scale * 100}%`, margin: '0 auto', paddingBottom: '200px' }}>
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

      {/* CONTROLS */}
      <div 
        class={`
            fixed bottom-0 left-0 w-full bg-slate-800 border-t border-slate-700 z-30 flex items-center justify-between px-2 py-2 shadow-2xl gap-2
            transition-transform duration-300 ease-in-out
            ${showControls.value ? 'translate-y-0' : 'translate-y-full'}
        `}
        onClick$={(e) => e.stopPropagation()} 
      >
        <button 
            onClick$={() => saveAction.submit({ bookId: bookSignal.value?.id, page: currentPage.value })}
            disabled={saveAction.isRunning}
            class={`
                flex items-center justify-center px-3 py-2 rounded text-xs font-bold uppercase shrink-0
                transition active:scale-95
                ${saveAction.status === 200 ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-500'}
            `}
        >
            {saveAction.isRunning ? '...' : saveAction.status === 200 ? '✔ Saved' : '🔖 Bookmark'}
        </button>

        <div class="flex items-center gap-1 bg-slate-900 rounded px-2 py-1 border border-slate-700">
             <input 
                type="number" 
                placeholder={String(currentPage.value)}
                value={manualPageInput.value}
                onInput$={(e) => manualPageInput.value = (e.target as HTMLInputElement).value}
                class="w-8 h-6 bg-transparent text-white text-center text-sm focus:outline-none"
             />
             <button 
                onClick$={() => jumpToPage(Number(manualPageInput.value))}
                class="text-slate-400 hover:text-white text-xs font-bold px-1"
             >
                GO
             </button>
        </div>

        <div class="flex items-center gap-1 shrink-0">
            <button onClick$={zoomOut} class="w-8 h-8 flex items-center justify-center bg-slate-700 text-white rounded hover:bg-slate-600 text-lg font-bold">-</button>
            <span class="text-xs text-slate-400 w-8 text-center font-mono">{Math.round(zoomState.scale * 100)}%</span>
            <button onClick$={zoomIn} class="w-8 h-8 flex items-center justify-center bg-slate-700 text-white rounded hover:bg-slate-600 text-lg font-bold">+</button>
        </div>
      </div>
    </div>
  );
});