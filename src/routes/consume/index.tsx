import { component$, useStore, useVisibleTask$, $, useSignal } from '@builder.io/qwik';
import { routeLoader$, routeAction$, server$, z, zod$, Form } from '@builder.io/qwik-city';
import { RecursiveCard } from '~/components/recursive-card';

// --- CONFIGURATION ---
// Add as many search engines as you want here
export const SEARCH_OPTIONS = [
  { id: 'yt', label: 'YouTube', icon: '📺', urlPrefix: 'https://www.youtube.com/results?search_query=' },
  { id: 'google', label: 'Google', icon: '🔍', urlPrefix: 'https://www.google.com/search?q=' },
  { id: 'wiki', label: 'Wikipedia', icon: '📚', urlPrefix: 'https://en.wikipedia.org/wiki/Special:Search?search=' },
  { id: 'bing', label: 'Bing', icon: '🟦', urlPrefix: 'https://www.bing.com/search?q=' },
];

export interface CardData {
  id: string;
  name: string;
  parentId: string | null;
  isLeaf: boolean;
}

// --- SERVER LOADERS & ACTIONS ---
export const useRootCardsLoader = routeLoader$(async () => {
  const backendUrl = import.meta.env.PUBLIC_BACKEND_URL; // Using Env Var
  try {
    const res = await fetch(`${backendUrl}/api/cards`, { headers: { 'Content-Type': 'application/json' }});
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) { return []; }
});

export const useCreateRootAction = routeAction$(async (data) => {
  const backendUrl = import.meta.env.PUBLIC_BACKEND_URL; // Using Env Var
  await fetch(`${backendUrl}/api/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: data.name, isLeaf: false, parentId: null })
  });
  return { success: true };
}, zod$({ name: z.string().min(1) }));

// Import Function
export const importTreeData = server$(async (treeJson: any) => {
  const backendUrl = import.meta.env.PUBLIC_BACKEND_URL; // Using Env Var
  await fetch(`${backendUrl}/api/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'import', tree: treeJson })
  });
  return true;
});

// Export Function
export const fetchExportData = server$(async () => {
  const backendUrl = import.meta.env.PUBLIC_BACKEND_URL; // Using Env Var
  const res = await fetch(`${backendUrl}/api/cards?export=true`);
  return await res.json();
});

export default component$(() => {
  const loaderData = useRootCardsLoader();
  const createAction = useCreateRootAction();
  const localRoots = useStore({ data: loaderData.value });
  
  const showInfo = useSignal(false);
  const showPasteModal = useSignal(false);
  const jsonPasteContent = useSignal('');
  const fileInputRef = useSignal<HTMLInputElement>();

  useVisibleTask$(({ track }) => {
    track(() => loaderData.value);
    if (loaderData.value.length > localRoots.data.length) localRoots.data = loaderData.value; 
  });

  const onRootDelete = $((id: string) => {
    localRoots.data = localRoots.data.filter(c => c.id !== id);
  });

  const handleFileUpload = $(async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        await importTreeData(json);
        alert('Tree imported! Refreshing...');
        location.reload();
      } catch (err) { alert('Invalid JSON file.'); }
    };
    reader.readAsText(file);
    target.value = ''; 
  });

  const handlePasteImport = $(async () => {
    try {
        if (!jsonPasteContent.value.trim()) return;
        const json = JSON.parse(jsonPasteContent.value);
        await importTreeData(json);
        alert('Tree imported from text! Refreshing...');
        location.reload();
    } catch (err) {
        alert('Invalid JSON text format.');
    }
  });

  const handleExport = $(async () => {
    const data = await fetchExportData();
    const jsonString = JSON.stringify(data.tree, null, 2); 
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `knowledge-tree-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  return (
    <div class="min-h-screen bg-slate-50 font-sans p-10 relative">
      <div class="max-w-4xl mx-auto">
        <h1 class="text-3xl font-bold text-slate-900 mb-6">Infinite Knowledge Tree</h1>

        {/* CONTROLS AREA */}
        <div class="mb-8 bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-4">
          
          <div class="flex gap-3">
             <Form action={createAction} class="flex-1 flex gap-3">
              <input name="name" type="text" placeholder="Start a new topic..." class="flex-1 border border-slate-300 rounded px-3 py-2" />
              <button type="submit" class="bg-slate-900 text-white px-6 py-2 rounded hover:bg-slate-800">Add Root</button>
            </Form>
          </div>

          <hr class="border-slate-100" />

          {/* Import / Export Controls */}
          <div class="flex items-center gap-3 flex-wrap">
            <span class="text-sm font-bold text-slate-600">Data:</span>
            
            <input type="file" accept=".json" ref={fileInputRef} class="hidden" onChange$={handleFileUpload} />
            <button onClick$={() => fileInputRef.value?.click()} class="text-sm bg-white border border-slate-300 px-3 py-1.5 rounded hover:bg-slate-50">
              📂 Import File
            </button>

            <button onClick$={() => showPasteModal.value = true} class="text-sm bg-white border border-slate-300 px-3 py-1.5 rounded hover:bg-slate-50">
              📋 Paste JSON
            </button>

            <button onClick$={handleExport} class="text-sm bg-white border border-slate-300 px-3 py-1.5 rounded hover:bg-slate-50">
              ⬇️ Export JSON
            </button>

            <button onClick$={() => showInfo.value = true} class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-bold hover:bg-blue-200 flex items-center justify-center ml-auto">
              i
            </button>
          </div>
        </div>

        {/* TREE */}
        <div class="border rounded-xl p-6 bg-white shadow-sm min-h-[500px]">
          {localRoots.data.length === 0 ? (
            <div class="text-center text-slate-400 mt-10">Tree is empty.</div>
          ) : (
            <div class="flex flex-col gap-2">
              {localRoots.data.map((card) => (
                <RecursiveCard 
                  key={card.id} 
                  card={card} 
                  ancestry={[]} 
                  onDelete$={onRootDelete}
                  searchOptions={SEARCH_OPTIONS} /* Passing the config array */
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PASTE JSON MODAL */}
      {showPasteModal.value && (
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn p-4">
            <div class="bg-white p-6 rounded-xl shadow-2xl max-w-2xl w-full relative">
                <button onClick$={() => showPasteModal.value = false} class="absolute top-4 right-4 text-gray-400 hover:text-gray-800 font-bold text-xl">&times;</button>
                <h3 class="text-xl font-bold mb-4">Paste JSON Tree</h3>
                <p class="text-sm text-gray-600 mb-2">Paste your exported JSON structure below:</p>
                <textarea 
                    bind:value={jsonPasteContent}
                    placeholder='[ { "name": "Example", "children": [...] } ]'
                    class="w-full h-64 border border-slate-300 rounded p-3 font-mono text-xs bg-slate-50 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
                <div class="flex justify-end gap-3">
                    <button onClick$={() => showPasteModal.value = false} class="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancel</button>
                    <button onClick$={handlePasteImport} class="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800">Import Data</button>
                </div>
            </div>
        </div>
      )}

      {/* INFO MODAL */}
      {showInfo.value && (
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn">
          <div class="bg-white p-6 rounded-xl shadow-2xl max-w-lg w-full relative">
            <button onClick$={() => showInfo.value = false} class="absolute top-4 right-4 text-gray-400 hover:text-gray-800 font-bold text-xl">&times;</button>
            <h3 class="text-xl font-bold mb-4">JSON Tree Format</h3>
            <p class="text-sm text-gray-600 mb-4">
              You can export your current tree to get a JSON file, or import one using this structure:
            </p>
            <div class="bg-slate-900 text-slate-50 p-4 rounded-lg text-xs font-mono overflow-auto max-h-64">
<pre>{`[
  {
    "name": "Science",
    "children": [
      {
        "name": "Physics",
        "children": [
          { "name": "Quantum Mechanics", "isLeaf": true }
        ]
      }
    ]
  }
]`}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});