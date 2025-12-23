import { component$, useSignal, useVisibleTask$, noSerialize, useStore, $ } from '@builder.io/qwik';

import { routeLoader$, routeAction$, Link, Form } from '@builder.io/qwik-city';


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

// State for Pinch Logic

const touchStartDist = useSignal(0);

const startWidth = useSignal(0);

const startHeight = useSignal(0);

const basePageWidth = useSignal(0);

// Store scroll position at pinch start

const scrollAtPinchStart = useStore<{ left: number; top: number }>({ left: 0, top: 0 });

const pinchCenter = useStore<{ x: number; y: number }>({ x: 0, y: 0 });

const pdfState = useStore<{ doc: any }>({ doc: undefined });


// Render Page

const renderPage = $(async (num: number) => {

if (!pdfState.doc || !canvasRef.value || !containerRef.value) return;


try {

const page = await pdfState.doc.getPage(num);

const containerWidth = containerRef.value.clientWidth;

const pixelRatio = window.devicePixelRatio || 1;

const unscaledViewport = page.getViewport({ scale: 1 });

const scale = (containerWidth - 20) / unscaledViewport.width;

const displayWidth = Math.floor(unscaledViewport.width * scale);

const displayHeight = Math.floor(unscaledViewport.height * scale);

basePageWidth.value = displayWidth;


const outputScale = scale * pixelRatio * 2;

const viewport = page.getViewport({ scale: outputScale });


const canvas = canvasRef.value;

const context = canvas.getContext('2d');


if (context) {

canvas.width = viewport.width;

canvas.height = viewport.height;

canvas.style.width = `${displayWidth}px`;

canvas.style.height = `${displayHeight}px`;


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

if(containerRef.value) containerRef.value.scrollTop = 0;

}

});


// --- FIXED PINCH LOGIC ---

const handleTouchStart = $((e: TouchEvent) => {

if (e.touches.length === 2 && canvasRef.value && containerRef.value) {

const t1 = e.touches[0];

const t2 = e.touches[1];

// Calculate initial distance

const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

touchStartDist.value = dist;

// Capture current size

const rect = canvasRef.value.getBoundingClientRect();

startWidth.value = rect.width;

startHeight.value = rect.height;

// Store initial scroll position

scrollAtPinchStart.left = containerRef.value.scrollLeft;

scrollAtPinchStart.top = containerRef.value.scrollTop;

// Calculate pinch center relative to container's content (including scroll)

const containerRect = containerRef.value.getBoundingClientRect();

pinchCenter.x = ((t1.clientX + t2.clientX) / 2) - containerRect.left + scrollAtPinchStart.left;

pinchCenter.y = ((t1.clientY + t2.clientY) / 2) - containerRect.top + scrollAtPinchStart.top;

}

});


const handleTouchMove = $((e: TouchEvent) => {

// 1 Finger: Let browser handle Pan/Scroll naturally

if (e.touches.length === 1) return;


// 2 Fingers: Handle Zoom manually

if (e.touches.length === 2 && canvasRef.value && containerRef.value) {

e.preventDefault();


const t1 = e.touches[0];

const t2 = e.touches[1];

const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);


if (touchStartDist.value > 0) {

const scaleFactor = currentDist / touchStartDist.value;

// Calculate new dimensions

let newWidth = startWidth.value * scaleFactor;

let newHeight = startHeight.value * scaleFactor;


// Limit Zoom Out

if (newWidth < basePageWidth.value) {

newWidth = basePageWidth.value;

newHeight = (basePageWidth.value / startWidth.value) * startHeight.value;

}

// Limit Zoom In (Max 5x)

if (newWidth > basePageWidth.value * 5) return;


// Apply new size

canvasRef.value.style.width = `${newWidth}px`;

canvasRef.value.style.height = `${newHeight}px`;


// --- FIXED SCROLL ADJUSTMENT ---

// Calculate how much the content has grown

const widthRatio = newWidth / startWidth.value;

const heightRatio = newHeight / startHeight.value;


// Adjust scroll to keep the pinch center point stable

const newScrollLeft = (pinchCenter.x * widthRatio) - (pinchCenter.x - scrollAtPinchStart.left);

const newScrollTop = (pinchCenter.y * heightRatio) - (pinchCenter.y - scrollAtPinchStart.top);


containerRef.value.scrollLeft = newScrollLeft;

containerRef.value.scrollTop = newScrollTop;

}

}

});


const handleTouchEnd = $((e: TouchEvent) => {

// Reset when pinch ends

if (e.touches.length < 2) {

touchStartDist.value = 0;

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

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

const loadingTask = pdfjs.getDocument(bookSignal.value.pdfUrl);

const pdf = await loadingTask.promise;

pdfState.doc = noSerialize(pdf);

totalPages.value = pdf.numPages;

await renderPage(currentPage.value);

isLoading.value = false;

} catch (error: any) {

console.error("PDF Init Error:", error);

loadError.value = "Failed to load PDF.";

isLoading.value = false;

}

});


// Attach Listeners

useVisibleTask$(({ cleanup }) => {

const el = containerRef.value;

if (!el) return;


el.addEventListener('touchstart', handleTouchStart, { passive: false });

el.addEventListener('touchmove', handleTouchMove, { passive: false });

el.addEventListener('touchend', handleTouchEnd, { passive: false });

cleanup(() => {

el.removeEventListener('touchstart', handleTouchStart);

el.removeEventListener('touchmove', handleTouchMove);

el.removeEventListener('touchend', handleTouchEnd);

});

});


if (loadError.value) return <div>Error: {loadError.value}</div>;


return (

<div class="h-[100dvh] flex flex-col bg-slate-900 overflow-hidden">

{/* HEADER */}

<div class="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-3 shrink-0 z-20 shadow-md">

<Link href="/" class="text-white text-lg">⬅</Link>

<h2 class="text-white text-sm font-bold">{bookSignal.value?.title}</h2>

<div class="flex gap-2">

<button onClick$={() => changePage(currentPage.value - 1)} class="text-white px-2">⬅</button>

<Form action={saveAction}>

<input type="hidden" name="bookId" value={bookSignal.value?.id} />

<input type="hidden" name="page" value={currentPage.value} />

<button class="bg-blue-600 px-2 rounded text-white text-xs py-1">Save</button>

</Form>

<button onClick$={() => changePage(currentPage.value + 1)} class="text-white px-2">➡</button>

</div>

</div>


{/* SCROLLABLE CONTAINER */}

<div

ref={containerRef}

class="flex-grow w-full bg-slate-600 overflow-auto relative"

>

<div class="min-h-full min-w-full flex p-2">

<canvas

ref={canvasRef}

style={{ margin: 'auto' }}

class="shadow-2xl bg-white block"

/>

</div>

</div>

</div>

); })