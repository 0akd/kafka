import { component$, useSignal } from '@builder.io/qwik';
import { routeAction$, routeLoader$, Form } from '@builder.io/qwik-city';

const BACKEND_URL = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3000';

export const useCardsLoader = routeLoader$(async () => {
  const res = await fetch(`${BACKEND_URL}/api/cards`, { cache: 'no-store' });
  if (!res.ok) return [];
  const json = await res.json();
  return json.data || [];
});

export const useManageCard = routeAction$(async (data) => {
  const url = `${BACKEND_URL}/api/cards${data.intent === 'delete' ? `?id=${data.id}` : ''}`;
  
  const methodMap: Record<string, string> = {
    add: 'POST',
    edit: 'PATCH',
    increment: 'PATCH',
    decrement: 'PATCH',
    delete: 'DELETE'
  };

  const res = await fetch(url, {
    method: methodMap[data.intent as string],
    headers: { 'Content-Type': 'application/json' },
    body: data.intent !== 'delete' ? JSON.stringify(data) : undefined,
  });

  if (!res.ok) throw new Error('Action failed');
  return { success: true };
});

export default component$(() => {
  const cards = useCardsLoader();
  const manageAction = useManageCard();
  const editingId = useSignal<number | null>(null);

  return (
    <div class="min-h-screen bg-slate-50 p-6 font-sans text-slate-900">
      <div class="max-w-3xl mx-auto">
        <h1 class="text-2xl font-black mb-8 text-blue-600 tracking-tight">CARD MANAGER ({cards.value.length})</h1>

        {/* CREATE CARD FORM */}
        <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-8">
          <Form action={manageAction} class="flex flex-col md:flex-row gap-2">
            <input type="hidden" name="intent" value="add" />
            <input name="title" placeholder="Title" class="flex-1 border p-2 rounded-xl" required />
            <input name="description" placeholder="Desc" class="flex-1 border p-2 rounded-xl" />
            <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold">Add</button>
          </Form>
        </div>

        {/* CARDS LIST */}
        <div class="space-y-4">
          {cards.value.map((card: any) => (
            <div key={card.id} class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center group">
              <div class="flex-1 w-full">
                {editingId.value === card.id ? (
                  <Form action={manageAction} onSubmitCompleted$={() => (editingId.value = null)} class="space-y-2">
                    <input type="hidden" name="intent" value="edit" /><input type="hidden" name="id" value={card.id} />
                    <input name="title" defaultValue={card.title} class="w-full border p-2 rounded-lg" />
                    <input name="description" defaultValue={card.description} class="w-full border p-2 rounded-lg" />
                    <div class="flex gap-2">
                        <button type="submit" class="bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-bold">Save</button>
                        <button type="button" onClick$={() => (editingId.value = null)} class="text-slate-400 text-xs font-bold">Cancel</button>
                    </div>
                  </Form>
                ) : (
                  <div>
                    <h3 class="font-bold text-lg">{card.title}</h3>
                    <p class="text-slate-500 text-sm">{card.description}</p>
                    <div class="mt-3 flex items-center gap-3">
                        {/* DECREMENT */}
                        <Form action={manageAction}>
                            <input type="hidden" name="intent" value="decrement" /><input type="hidden" name="id" value={card.id} />
                            <button type="submit" class="bg-slate-100 h-8 w-8 rounded-full font-bold hover:bg-red-50 hover:text-red-600 transition">-</button>
                        </Form>

                        <span class="font-black text-blue-600 bg-blue-50 px-4 py-1 rounded-full border border-blue-100">{card.counter}</span>

                        {/* INCREMENT */}
                        <Form action={manageAction}>
                            <input type="hidden" name="intent" value="increment" /><input type="hidden" name="id" value={card.id} />
                            <button type="submit" class="bg-slate-100 h-8 w-8 rounded-full font-bold hover:bg-green-50 hover:text-green-600 transition">+</button>
                        </Form>
                    </div>
                  </div>
                )}
              </div>

              {/* ACTIONS */}
              {!editingId.value && (
                <div class="flex gap-4 mt-4 md:mt-0 opacity-0 group-hover:opacity-100 transition">
                  <button onClick$={() => (editingId.value = card.id)} class="text-xs font-bold text-slate-400 hover:text-blue-600">EDIT</button>
                  <Form action={manageAction} onSubmit$={(e) => !confirm('Delete?') && e.preventDefault()}>
                    <input type="hidden" name="intent" value="delete" /><input type="hidden" name="id" value={card.id} />
                    <button type="submit" class="text-xs font-bold text-slate-400 hover:text-red-600">DELETE</button>
                  </Form>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});