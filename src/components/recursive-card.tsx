import { component$, useSignal, useStore, $, useStylesScoped$ } from '@builder.io/qwik';
import { server$ } from '@builder.io/qwik-city';
import type { CardData } from '~/routes/consume/index'; // Update path if needed

// Interface for Search Options
export interface SearchOption {
  id: string;
  label: string;
  icon: string;
  urlPrefix: string;
}

interface Props {
  card: CardData;
  ancestry: string[];
  onDelete$?: (id: string) => void;
  searchOptions?: SearchOption[]; 
}

// --- SERVER FUNCTIONS (Using Env Var) ---

export const fetchChildren = server$(async (parentId: string) => {
  const backendUrl = import.meta.env.PUBLIC_BACKEND_URL;
  const res = await fetch(`${backendUrl}/api/cards?parentId=${parentId}`);
  return await res.json();
});

export const createChildCard = server$(async (name: string, parentId: string, isLeaf: boolean) => {
  const backendUrl = import.meta.env.PUBLIC_BACKEND_URL;
  const res = await fetch(`${backendUrl}/api/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parentId, isLeaf })
  });
  return await res.json();
});

export const updateCardName = server$(async (id: string, name: string) => {
  const backendUrl = import.meta.env.PUBLIC_BACKEND_URL;
  const res = await fetch(`${backendUrl}/api/cards`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, name })
  });
  return await res.json();
});

export const deleteCard = server$(async (id: string) => {
  const backendUrl = import.meta.env.PUBLIC_BACKEND_URL;
  await fetch(`${backendUrl}/api/cards?id=${id}`, {
    method: 'DELETE',
  });
  return true;
});

export const RecursiveCard = component$<Props>(({ card, ancestry, onDelete$, searchOptions }) => {
  useStylesScoped$(`
    .tree-line { position: absolute; left: -18px; top: 0; bottom: 0; width: 2px; background-color: #e2e8f0; }
  `);

  const isOpen = useSignal(false);
  const isEditing = useSignal(false);
  const editName = useSignal(card.name);
  const childrenStore = useStore<{ data: CardData[]; loaded: boolean }>({ data: [], loaded: false });
  const newChildName = useSignal('');
  const isAdding = useSignal(false);

  // Toggle Folder
  const toggleOpen = $(async () => {
    isOpen.value = !isOpen.value;
    if (isOpen.value && !childrenStore.loaded && !card.isLeaf) {
      const data = await fetchChildren(card.id);
      childrenStore.data = Array.isArray(data) ? data : [];
      childrenStore.loaded = true;
    }
  });

  // Create Child
  const handleCreate = $(async (isLeaf: boolean) => {
    if (!newChildName.value) return;
    const newCard = await createChildCard(newChildName.value, card.id, isLeaf);
    childrenStore.data = [...childrenStore.data, newCard];
    newChildName.value = '';
    isAdding.value = false;
    isOpen.value = true;
  });

  // Handle Rename
  const handleRename = $(async () => {
    if (editName.value !== card.name) {
      await updateCardName(card.id, editName.value);
      card.name = editName.value; // Update local prop visually
    }
    isEditing.value = false;
  });

  // Handle Delete
  const handleDelete = $(async () => {
    if (confirm('Are you sure you want to delete this?')) {
      await deleteCard(card.id);
      if (onDelete$) onDelete$(card.id); 
    }
  });

  // Handle Child Deletion (Update local store)
  const onChildDelete = $((childId: string) => {
    childrenStore.data = childrenStore.data.filter(c => c.id !== childId);
  });

  // --- UPDATED SEARCH LOGIC ---
  // Order: [Current Card] -> [Parent] -> [Grandparent] ...
  // Example: "Quantum Mechanics" "Physics" "Science"
  const searchQuery = [card.name, ...[...ancestry].reverse()].join(' ');

  return (
    <div class="relative ml-8 mt-2">
      {ancestry.length > 0 && <div class="tree-line"></div>}

      <div class="flex flex-col">
        {/* CARD ROW */}
        <div class="flex items-center gap-3 group">
          
          {isEditing.value ? (
            // EDIT MODE
            <div class="flex items-center gap-2">
              <input 
                bind:value={editName}
                class="border rounded px-2 py-1 text-sm"
                autoFocus
              />
              <button onClick$={handleRename} class="text-green-600 text-xs font-bold">Save</button>
              <button onClick$={() => isEditing.value = false} class="text-gray-500 text-xs">Cancel</button>
            </div>
          ) : (
            // VIEW MODE
            <div 
              onClick$={!card.isLeaf ? toggleOpen : undefined}
              class={`
                cursor-pointer px-4 py-2 rounded-lg border shadow-sm transition-all select-none flex items-center gap-2
                ${card.isLeaf 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100' 
                  : 'bg-white border-slate-200 text-slate-700 hover:border-blue-400 hover:text-blue-600'}
              `}
            >
              <span class="text-lg">{card.isLeaf ? '🍃' : (isOpen.value ? '📂' : '📁')}</span>
              <span class="font-medium">{card.name}</span>
            </div>
          )}

          {/* ACTION BUTTONS (Edit/Delete/Add) - Visible on Hover */}
          {!isEditing.value && (
            <div class="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 items-center">
              {/* Add Child (Only for folders) */}
              {!card.isLeaf && (
                <button 
                  onClick$={() => isAdding.value = !isAdding.value}
                  class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded border"
                  title="Add Child"
                >
                  +
                </button>
              )}
              
              {/* Edit */}
              <button 
                onClick$={() => isEditing.value = true}
                class="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-2 py-1 rounded border"
                title="Rename"
              >
                ✎
              </button>

              {/* Delete */}
              <button 
                onClick$={handleDelete}
                class="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 rounded border"
                title="Delete"
              >
                🗑
              </button>
            </div>
          )}
        </div>

        {/* ADD NEW CHILD INPUT */}
        {isAdding.value && (
          <div class="mt-2 ml-4 flex gap-2 animate-fadeIn">
            <input 
              bind:value={newChildName}
              placeholder="Name..."
              class="border rounded px-2 py-1 text-sm focus:outline-blue-500"
              autoFocus
            />
            <button onClick$={() => handleCreate(false)} class="bg-blue-100 text-blue-700 px-2 rounded text-xs hover:bg-blue-200 font-bold">Folder</button>
            <button onClick$={() => handleCreate(true)} class="bg-emerald-100 text-emerald-700 px-2 rounded text-xs hover:bg-emerald-200 font-bold">Leaf</button>
          </div>
        )}

        {/* DYNAMIC SEARCH BUTTONS (Leaves Only) */}
        {card.isLeaf && !isEditing.value && searchOptions && searchOptions.length > 0 && (
          <div class="mt-2 ml-4 flex flex-wrap gap-2">
            {searchOptions.map((opt) => (
              <a
                key={opt.id}
                href={`${opt.urlPrefix}${encodeURIComponent(searchQuery)}`}
                target="_blank"
                rel="noopener noreferrer"
                class="text-xs flex items-center gap-1 px-3 py-1 bg-white border border-slate-200 rounded-full hover:bg-slate-50 text-slate-700 transition-colors no-underline shadow-sm hover:shadow"
              >
                <span>{opt.icon}</span>
                <span>{opt.label}</span>
              </a>
            ))}
          </div>
        )}

        {/* RECURSIVE CHILDREN */}
        {isOpen.value && childrenStore.data.length > 0 && (
          <div class="mt-2 border-l-2 border-slate-100">
            {childrenStore.data.map((child) => (
              <RecursiveCard 
                key={child.id} 
                card={child} 
                ancestry={[...ancestry, card.name]} 
                onDelete$={onChildDelete}
                searchOptions={searchOptions} // Pass props down!
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});