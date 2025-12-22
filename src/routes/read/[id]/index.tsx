import { component$, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { routeLoader$, routeAction$, Link, Form } from '@builder.io/qwik-city';

// --- BACKEND LOGIC (Save/Load) ---
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
  } catch {
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

  // 🔥 Proxy hata diya. Ab hum seedha Google Viewer use karenge
  // Google viewer url aise banta hai:
  // https://docs.google.com/viewer?url={LINK}&embedded=true
  
  let savedPage = 1;
  const userCookie = cookie.get('user_session');
  if (userCookie?.value) {
    const user = JSON.parse(userCookie.value);
    try {
      const pRes = await fetch(`${backendUrl}/api/progress?userId=${user.id}&bookId=${bookId}`);
      if (pRes.ok) savedPage = (await pRes.json()).page || 1;
    } catch {}
  }

  return { id: bookData.id, pdfUrl: originalPdfUrl, title: bookData.title, initialPage: savedPage };
});

// --- UI COMPONENT ---
export default component$(() => {
  const bookSignal = useReaderData();
  const saveAction = useSavePage();
  
  // Note: Google Viewer mein hum current page detect nahi kar sakte
  // Toh hum user ko manually page number update karne denge
  const manualPage = useSignal(bookSignal.value?.initialPage || 1);

  if (bookSignal.value?.error) {
      return <div class="text-white p-10">Error: {bookSignal.value.error}</div>
  }

  return (
    <div class="h-[100dvh] flex flex-col bg-slate-900 overflow-hidden">
      
      {/* HEADER */}
      <div class="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-3 shrink-0 z-10">
        <div class="flex items-center gap-3">
            <Link href="/" class="text-white text-lg">⬅</Link>
            <div>
                 <h2 class="text-white font-bold truncate max-w-[150px] text-sm">{bookSignal.value?.title}</h2>
                 <p class="text-[10px] text-slate-400">View Only Mode</p>
            </div>
        </div>

        <div class="flex items-center gap-2">
            {/* Manual Save Logic */}
            <Form action={saveAction} class="flex gap-2 items-center">
                <input type="hidden" name="bookId" value={bookSignal.value?.id} />
                <input 
                  type="number" 
                  name="page" 
                  value={manualPage.value}
                  onInput$={(e) => manualPage.value = parseInt((e.target as HTMLInputElement).value)}
                  class="w-12 h-7 bg-slate-700 text-white text-center rounded text-xs"
                  placeholder="Pg"
                />
                <button type="submit" class="bg-blue-600 px-3 py-1.5 rounded text-white text-xs font-bold">Save Pg</button>
            </Form>
        </div>
      </div>

      {/* GOOGLE VIEWER IFRAME */}
      <div class="flex-grow w-full bg-slate-600 relative">
        <iframe 
            src={`https://docs.google.com/viewer?url=${encodeURIComponent(bookSignal.value?.pdfUrl || '')}&embedded=true`}
            class="w-full h-full border-0"
            frameBorder="0"
        ></iframe>
      </div>
    </div>
  );
});