import { component$, useSignal } from '@builder.io/qwik';
import { routeAction$, routeLoader$, Form, Link } from '@builder.io/qwik-city';

const BACKEND_URL = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3001';

// --- TYPE DEFINITION (Ye TypeScript error fix karega) ---
interface Book {
  id: number;
  title: string;
  subtitle?: string | null;
  price: number;
  currency?: string;
  coverUrl: string;
  category: string;
  pdfUrl?: string | null;
}

// --- LOADER: Check Authentication & Fetch Books ---
export const useManagerLoader = routeLoader$(async ({ cookie, error, redirect, url }) => {
  // 1. Get User Session
  const userCookie = cookie.get('user_session');
  if (!userCookie?.value) throw redirect(302, '/');

  const user = JSON.parse(userCookie.value);

  // 2. CHECK EMAIL AUTHORIZATION
  const allowedEmails = ['atrikumar31@gmail.com', 'reboostify@gmail.com'];
  if (!allowedEmails.includes(user.email)) {
    throw error(403, 'Access Denied: You are not an admin.');
  }

  // 3. Fetch all books
  const booksRes = await fetch(`${BACKEND_URL}/api/books`);
  if (!booksRes.ok) throw error(500, 'Failed to fetch books');

  const jsonResponse = await booksRes.json();
  const rawBooks = jsonResponse.data || [];

  // Fix: Map snake_case (backend) to camelCase (frontend) with TYPE
  const allBooks: Book[] = rawBooks.map((b: any) => ({
    id: b.id,
    title: b.title,
    subtitle: b.subtitle,
    price: b.price,
    currency: b.currency,
    // 👇 Dual check for safety (coverUrl from Drizzle, cover_url from raw SQL)
    coverUrl: b.coverUrl || b.cover_url, 
    category: b.category,
    pdfUrl: b.pdfUrl || b.pdf_url      
  }));

  // 4. If editing, fetch specific book
  const editId = url.searchParams.get('edit');
  let editingBook: Book | null = null;

  if (editId) {
    const bookRes = await fetch(`${BACKEND_URL}/api/books/${editId}`);
    if (bookRes.ok) {
      const bookJson = await bookRes.json();
      const rawBook = bookJson.data || (Array.isArray(bookJson) ? bookJson[0] : bookJson);
      
      if (rawBook) {
        editingBook = {
            id: rawBook.id,
            title: rawBook.title,
            subtitle: rawBook.subtitle,
            price: rawBook.price,
            currency: rawBook.currency,
            category: rawBook.category,
            // Mapping fix here too
            coverUrl: rawBook.coverUrl || rawBook.cover_url, 
            pdfUrl: rawBook.pdfUrl || rawBook.pdf_url
        };
      }
    }
  }

  return { allBooks, editingBook, user };
});

// --- ACTION: Save Book (Create or Update) ---
export const useSaveBook = routeAction$(async (data, { cookie, fail }) => {
  const userCookie = cookie.get('user_session');
  if (!userCookie?.value) return fail(401, { message: 'Unauthorized' });
  
  const user = JSON.parse(userCookie.value);
  const allowedEmails = ['atrikumar31@gmail.com', 'reboostify@gmail.com'];

  if (!allowedEmails.includes(user.email)) return fail(403, { message: 'Forbidden' });

  const priceInCents = Math.round(Number(data.price) * 100);
  
  // Prepare payload: Convert camelCase back to snake_case for backend
  const payload = {
    title: data.title,
    subtitle: data.subtitle || null,
    price: priceInCents,
    currency: '$',
    cover_url: data.coverUrl, // Backend expects cover_url
    category: data.category,
    pdf_url: data.pdfUrl || null // Backend expects pdf_url
  };

  try {
    const endpoint = data.id 
      ? `${BACKEND_URL}/api/books/${data.id}` 
      : `${BACKEND_URL}/api/books`;

    const method = data.id ? 'PUT' : 'POST';

    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const error = await res.json();
      return fail(res.status, { message: error.error || 'Operation failed' });
    }

    return { success: true };
  } catch (err) {
    return fail(500, { message: 'Network error' });
  }
});

// --- ACTION: Delete Book ---
export const useDeleteBook = routeAction$(async (data, { cookie, fail }) => {
  const userCookie = cookie.get('user_session');
  if (!userCookie?.value) return fail(401, { message: 'Unauthorized' });
  
  try {
    const res = await fetch(`${BACKEND_URL}/api/books/${data.id}`, {
      method: 'DELETE',
    });

    if (!res.ok) return fail(res.status, { message: 'Delete failed' });
    return { success: true };
  } catch (err) {
    return fail(500, { message: 'Network error' });
  }
});

// --- UI COMPONENT ---
export default component$(() => {
  const loader = useManagerLoader();
  const saveAction = useSaveBook();
  const deleteAction = useDeleteBook();
  const pendingDeleteId = useSignal<number | null>(null);

  const isEditing = !!loader.value.editingBook;
  const formValues = loader.value.editingBook;

  return (
    <div class="min-h-screen bg-slate-50 p-6 md:p-10 font-sans relative">
      <div class="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* --- LEFT: FORM --- */}
        <div class="md:col-span-5">
          <div class="bg-white p-6 rounded-2xl shadow-lg sticky top-6">
            <h2 class="text-xl font-bold text-slate-900 mb-4 flex justify-between">
              {isEditing ? 'Edit Book' : 'Add New Book'}
              {isEditing && <Link href="/admin" class="text-xs text-red-500 underline">Cancel</Link>}
            </h2>

            {saveAction.value?.success && <div class="bg-green-100 text-green-800 p-2 rounded mb-4 text-xs">✅ Saved successfully!</div>}
            
            <Form action={saveAction} class="space-y-3">
              {isEditing && <input type="hidden" name="id" value={formValues?.id} />}
              
              <div>
                <label class="text-xs font-bold text-slate-500 uppercase">Title</label>
                <input name="title" value={formValues?.title} required class="w-full p-2 border rounded text-sm" />
              </div>

              <div>
                <label class="text-xs font-bold text-slate-500 uppercase">Subtitle</label>
                <input name="subtitle" value={formValues?.subtitle || ''} class="w-full p-2 border rounded text-sm" />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="text-xs font-bold text-slate-500 uppercase">Price ($)</label>
                  <input name="price" type="number" step="0.01" value={formValues ? (formValues.price / 100).toFixed(2) : ''} required class="w-full p-2 border rounded text-sm" />
                </div>
                <div>
                  <label class="text-xs font-bold text-slate-500 uppercase">Category</label>
                  <input name="category" list="opts" value={formValues?.category} required class="w-full p-2 border rounded text-sm" />
                  <datalist id="opts"><option value="engineering"/><option value="philosophy"/></datalist>
                </div>
              </div>

              <div>
                <label class="text-xs font-bold text-slate-500 uppercase">Cover URL</label>
                <input name="coverUrl" value={formValues?.coverUrl} required class="w-full p-2 border rounded text-sm font-mono text-xs" />
              </div>

              <div>
                <label class="text-xs font-bold text-slate-500 uppercase">PDF URL</label>
                <input name="pdfUrl" value={formValues?.pdfUrl || ''} class="w-full p-2 border rounded text-sm font-mono text-xs" />
              </div>

              <button type="submit" class="w-full bg-blue-600 text-white font-bold py-3 rounded hover:bg-blue-700 mt-2">
                {saveAction.isRunning ? 'Saving...' : (isEditing ? 'Update' : 'Add Book')}
              </button>
            </Form>
          </div>
        </div>

        {/* --- RIGHT: LIST --- */}
        <div class="md:col-span-7">
            <h2 class="text-xl font-bold mb-4">Inventory ({loader.value.allBooks.length})</h2>
            <div class="bg-white rounded-xl shadow-sm overflow-hidden border">
                {/* 👇 Type inference ab automatically kaam karega kyunki loader typed hai */}
                {loader.value.allBooks.map((book) => (
                    <div key={book.id} class="p-3 border-b flex gap-4 items-center hover:bg-slate-50">
                        <img src={book.coverUrl} class="w-10 h-14 object-cover bg-slate-200" />
                        <div class="flex-grow">
                            <div class="font-bold text-sm">{book.title}</div>
                            <div class="text-xs text-slate-500">${(book.price/100).toFixed(2)} • {book.category}</div>
                        </div>
                        <div class="flex gap-2">
                            <Link href={`/admin?edit=${book.id}`} class="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">Edit</Link>
                            <button onClick$={() => pendingDeleteId.value = book.id} class="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded">Delete</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>

      </div>
      
      {/* DELETE MODAL */}
      {pendingDeleteId.value && (
        <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div class="bg-white p-6 rounded-lg shadow-xl">
                <h3 class="font-bold text-lg mb-4">Delete Book?</h3>
                <div class="flex gap-4">
                    <button onClick$={() => pendingDeleteId.value = null} class="px-4 py-2 bg-slate-200 rounded font-bold">Cancel</button>
                    <Form action={deleteAction} onSubmitCompleted$={() => pendingDeleteId.value = null}>
                        <input type="hidden" name="id" value={pendingDeleteId.value} />
                        <button class="px-4 py-2 bg-red-600 text-white rounded font-bold">Yes, Delete</button>
                    </Form>
                </div>
            </div>
        </div>
      )}
    </div>
  );
});