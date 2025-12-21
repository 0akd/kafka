import { component$, useSignal } from '@builder.io/qwik';
import { routeAction$, routeLoader$, Form, Link } from '@builder.io/qwik-city';
import { eq } from 'drizzle-orm';
import { db } from '~/db';
import { books } from '~/db/schema';

// --- LOADER & ACTIONS (No changes needed here) ---
export const useManagerLoader = routeLoader$(async ({ url }) => {
  const allBooks = await db.select().from(books).all();
  const editId = url.searchParams.get('edit');
  let editingBook = null;

  if (editId) {
    const result = await db.select().from(books).where(eq(books.id, Number(editId))).get();
    editingBook = result || null;
  }
  return { allBooks, editingBook };
});

export const useSaveBook = routeAction$(async (data) => {
  const priceInCents = Math.round(Number(data.price) * 100);
  const values = {
    title: data.title as string,
    subtitle: (data.subtitle as string) || null,
    price: priceInCents,
    currency: '$',
    coverUrl: data.coverUrl as string,
    category: data.category as string,
    pdfUrl: (data.pdfUrl as string) || null, 
  };

  if (data.id) {
    await db.update(books).set(values).where(eq(books.id, Number(data.id)));
  } else {
    await db.insert(books).values(values);
  }
  return { success: true };
});

export const useDeleteBook = routeAction$(async (data) => {
  if (data.id) {
    await db.delete(books).where(eq(books.id, Number(data.id)));
  }
  return { success: true };
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
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-xl font-bold text-slate-900">
                {isEditing ? 'Edit Book' : 'Add New Book'}
              </h2>
              {isEditing && (
                <Link href="/admin" class="text-xs text-slate-500 hover:text-red-500 font-bold underline">
                  Cancel Edit
                </Link>
              )}
            </div>

            {saveAction.value?.success && (
              <div class="bg-green-100 text-green-800 p-3 rounded-lg mb-4 text-xs font-bold">
                {isEditing ? '✅ Changes saved!' : '✅ Book created!'}
              </div>
            )}

            <Form action={saveAction} class="space-y-3">
              {isEditing && <input type="hidden" name="id" value={formValues?.id} />}
              
              <div>
                <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Title</label>
                <input name="title" value={formValues?.title} required class="w-full p-2 border border-slate-200 rounded text-sm" />
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Subtitle</label>
                <input name="subtitle" value={formValues?.subtitle} class="w-full p-2 border border-slate-200 rounded text-sm" />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Price ($)</label>
                  <input name="price" type="number" step="0.01" value={formValues ? (formValues.price / 100).toFixed(2) : ''} required class="w-full p-2 border border-slate-200 rounded text-sm" />
                </div>
                
                {/* --- CHANGED: Category is now an INPUT with Suggestions --- */}
                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                  <input 
                    name="category" 
                    list="categoryOptions"
                    value={formValues?.category} 
                    required
                    placeholder="Type or select..."
                    class="w-full p-2 border border-slate-200 rounded text-sm bg-white"
                  />
                  {/* Suggestions list */}
                  <datalist id="categoryOptions">
                    <option value="engineering" />
                    <option value="advanced" />
                    <option value="devops" />
                    <option value="microservices" />
                    <option value="architecture" />
                  </datalist>
                </div>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Cover URL</label>
                <input name="coverUrl" value={formValues?.coverUrl} required class="w-full p-2 border border-slate-200 rounded text-sm font-mono text-xs" />
              </div>
              
              <div>
                <label class="block text-xs font-bold text-slate-500 uppercase mb-1">
                  PDF URL (Optional)
                </label>
                <input 
                  name="pdfUrl" 
                  value={formValues?.pdfUrl || ''} 
                  placeholder="https://cdn.example.com/book.pdf"
                  class="w-full p-2 border border-slate-200 rounded text-sm font-mono text-xs" 
                />
              </div>

              <button type="submit" class={`w-full text-white font-bold py-3 rounded-lg transition-all mt-2 ${isEditing ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {saveAction.isRunning ? 'Saving...' : (isEditing ? 'Update Book' : 'Add Book')}
              </button>
            </Form>
          </div>
        </div>

        {/* --- RIGHT: LIST --- */}
        <div class="md:col-span-7 space-y-4">
          <h2 class="text-xl font-bold text-slate-900 flex items-center justify-between">
            <span>Inventory</span>
            <span class="text-sm font-normal text-slate-500">{loader.value.allBooks.length} items</span>
          </h2>

          <div class="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
            {loader.value.allBooks.map((book) => (
              <div key={book.id} class="p-4 border-b border-slate-100 last:border-0 flex gap-4 items-center hover:bg-slate-50 transition-colors group">
                <div class="w-12 h-16 shrink-0 bg-slate-200 rounded overflow-hidden">
                    <img src={book.coverUrl} class="w-full h-full object-cover" />
                </div>

                <div class="flex-grow">
                  <h3 class="font-bold text-slate-800 text-sm">{book.title}</h3>
                  <div class="text-xs text-slate-500 flex gap-2 mt-1">
                    <span class="bg-slate-100 px-2 py-0.5 rounded text-slate-600 uppercase tracking-wider text-[10px]">{book.category}</span>
                    <span>${(book.price / 100).toFixed(2)}</span>
                  </div>
                </div>

                <div class="flex gap-2">
                  <Link href={`/admin?edit=${book.id}`} class="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors">
                    Edit
                  </Link>
                  <button onClick$={() => pendingDeleteId.value = book.id} class="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors opacity-60 group-hover:opacity-100">
                    Delete
                  </button>
                </div>
              </div>
            ))}
            
            {loader.value.allBooks.length === 0 && (
              <div class="p-8 text-center text-slate-400 text-sm">No books found.</div>
            )}
          </div>
        </div>
      </div>

      {/* --- CONFIRMATION POPUP --- */}
      {pendingDeleteId.value && (
        <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div class="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full animate-in fade-in zoom-in duration-200">
            <h3 class="text-lg font-bold text-slate-900 mb-2">Delete this book?</h3>
            <p class="text-slate-500 text-sm mb-6">Are you sure?</p>
            <div class="flex gap-3">
              <button onClick$={() => pendingDeleteId.value = null} class="flex-1 py-2.5 px-4 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 text-sm">Cancel</button>
              <Form action={deleteAction} onSubmitCompleted$={() => pendingDeleteId.value = null} class="flex-1">
                <input type="hidden" name="id" value={pendingDeleteId.value} />
                <button type="submit" class="w-full py-2.5 px-4 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 text-sm">Yes, Delete</button>
              </Form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});