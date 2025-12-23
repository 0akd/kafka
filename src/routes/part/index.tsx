import { component$, useSignal } from '@builder.io/qwik';
import { routeAction$, routeLoader$, Form } from '@builder.io/qwik-city';
import { useUserLoader } from '../layout';

const BACKEND_URL = import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3000';

/* ---------------------------------
   LOAD CARDS
--------------------------------- */
export const useCardsLoader = routeLoader$(async ({ resolveValue }) => {
  const user = await resolveValue(useUserLoader);
  if (!user) return [];
  const res = await fetch(`${BACKEND_URL}/api/cards?userId=${user.id}`, { cache: 'no-store' });
  if (!res.ok) return [];
  const json = await res.json();
  return json.data || [];
});
type CardIntent =
  | 'add'
  | 'edit'
  | 'increment'
  | 'decrement'
  | 'delete';

interface ManageCardForm {
  intent: CardIntent;
  userId: string;
  id?: number;
  title?: string;
  description?: string;
  counter?: number;
}

interface ActionResult {
  success: boolean;
}

export const useManageCard = routeAction$<ActionResult>(
  async (form) => {
    // 🔒 Runtime narrowing (MANDATORY)
    if (
      typeof form !== 'object' ||
      form === null ||
      typeof form.intent !== 'string' ||
      typeof form.userId !== 'string'
    ) {
      throw new Error('Invalid form submission');
    }

const data = form as unknown as ManageCardForm;

    const methodMap: Record<CardIntent, string> = {
      add: 'POST',
      edit: 'PATCH',
      increment: 'PATCH',
      decrement: 'PATCH',
      delete: 'DELETE',
    };

    const url =
      `${BACKEND_URL}/api/cards` +
      (data.intent === 'delete'
        ? `?id=${data.id}&userId=${data.userId}`
        : '');

    const res = await fetch(url, {
      method: methodMap[data.intent],
      headers: { 'Content-Type': 'application/json' },
      body: data.intent !== 'delete' ? JSON.stringify(data) : undefined,
    });

    if (!res.ok) {
      throw new Error('Action failed');
    }

    return { success: true };
  }
);



export default component$(() => {
  const cards = useCardsLoader();
  const manageAction = useManageCard();
  const editingId = useSignal<number | null>(null);
  const user = useUserLoader(); 
  const isModalOpen = useSignal(false);
  
  // Naya signal: track karne ke liye ki kaunsa counter edit ho raha hai
  const editingCounterId = useSignal<number | null>(null);

  if (!user.value) return <p class="p-6">Please log in</p>;

  return (
    <div class="min-h-screen bg-slate-50 p-6 pb-24 relative">
      <div class="max-w-3xl mx-auto">
        <h1 class="text-2xl font-black mb-8 text-blue-600 uppercase tracking-tight">
          Card Tracker ({cards.value.length})
        </h1>

        {cards.value.map((card: any) => (
          <div key={card.id} class="bg-white p-6 mb-4 rounded-2xl shadow-sm border border-slate-100">
            {editingId.value === card.id ? (
              <Form action={manageAction} onSubmitCompleted$={() => editingId.value = null}>
                <div class="flex flex-col gap-3">
                  <input type="hidden" name="intent" value="edit" />
                  <input type="hidden" name="id" value={card.id} />
                  <input type="hidden" name="userId" value={user.value.id} />
                  <input name="title" defaultValue={card.title} class="border p-2 rounded-lg" />
                  <input name="description" defaultValue={card.description} placeholder="Units (e.g. kg, reps)" class="border p-2 rounded-lg" />
                  <div class="flex gap-2">
                    <button class="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold">Update</button>
                    <button type="button" onClick$={() => editingId.value = null} class="text-gray-500">Cancel</button>
                  </div>
                </div>
              </Form>
            ) : (
              <>
                <h3 class="text-xl font-bold text-center text-gray-700">{card.title}</h3>
                
                <div class="flex items-center justify-center gap-8 my-6">
                  {/* DECREMENT */}
                  <Form action={manageAction}>
                    <input type="hidden" name="intent" value="decrement" />
                    <input type="hidden" name="id" value={card.id} />
                    <input type="hidden" name="userId" value={user.value.id} />
                    <button class="w-10 h-10 rounded-full bg-red-50 text-red-600 text-2xl font-bold hover:bg-red-100">−</button>
                  </Form>

         
<div class="text-center min-w-[100px]">
  {editingCounterId.value === card.id ? (
    <Form
      action={manageAction}
      onSubmitCompleted$={() => (editingCounterId.value = null)}
    >
      <input type="hidden" name="intent" value="edit" />
      <input type="hidden" name="id" value={card.id} />
      <input type="hidden" name="userId" value={user.value.id} />
      <input type="hidden" name="title" value={card.title} />
      <input type="hidden" name="description" value={card.description} />

      <input
        type="number"
        name="counter"
        autoFocus
        min={0}
        defaultValue={card.counter}
        class="w-20 text-4xl font-black text-center border-b-2 border-blue-500 outline-none bg-transparent"
        onBlur$={(e, currentTarget) => {
          if (editingCounterId.value === card.id) {
            currentTarget.form?.requestSubmit();
          }
        }}
      />
    </Form>
  ) : (
    <span
      class="text-5xl font-black text-gray-800 cursor-pointer hover:text-blue-600 transition-colors"
      onClick$={() => (editingCounterId.value = card.id)}
    >
      {card.counter}
    </span>
  )}

  {/* Units */}
  <p class="text-xs font-bold text-gray-400 uppercase mt-1">
    {card.description || 'Units'}
  </p>

  {/* 🔥 RECORD (NEW) */}
  <p class="text-[11px] font-semibold text-blue-500 mt-1 uppercase tracking-wide">
    Record: {card.record ?? card.counter}
  </p>
</div>


                  {/* INCREMENT */}
                  <Form action={manageAction}>
                    <input type="hidden" name="intent" value="increment" />
                    <input type="hidden" name="id" value={card.id} />
                    <input type="hidden" name="userId" value={user.value.id} />
                    <button class="w-10 h-10 rounded-full bg-green-50 text-green-600 text-2xl font-bold hover:bg-green-100">+</button>
                  </Form>
                </div>

                <div class="flex justify-center gap-6 mt-2 border-t pt-4">
                  <button class="text-slate-400 text-sm hover:text-blue-600" onClick$={() => (editingId.value = card.id)}>Edit Details</button>
                  <Form action={manageAction}>
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="id" value={card.id} />
                    <input type="hidden" name="userId" value={user.value.id} />
                    <button class="text-slate-400 text-sm hover:text-red-600">Delete</button>
                  </Form>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* FAB */}
      <button onClick$={() => isModalOpen.value = true} class="fixed bottom-8 right-8 w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl text-4xl shadow-blue-200 flex items-center justify-center hover:scale-110 transition-transform z-40">+</button>

      {/* POPUP MODAL */}
      {isModalOpen.value && (
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick$={() => isModalOpen.value = false} />
          <div class="bg-white p-8 rounded-3xl shadow-2xl relative w-full max-w-md">
            <h2 class="text-2xl font-bold mb-6">Create New Tracker</h2>
            <Form action={manageAction} onSubmitCompleted$={() => isModalOpen.value = false} class="space-y-4">
              <input type="hidden" name="intent" value="add" />
              <input type="hidden" name="userId" value={user.value.id} />
              
              <div>
                <label class="text-sm font-bold text-gray-500 uppercase ml-1">Title</label>
                <input name="title" required class="w-full border-2 border-slate-100 p-3 rounded-xl mt-1 focus:border-blue-500 outline-none" placeholder="e.g. Water Intake" />
              </div>
              
              <div>
                <label class="text-sm font-bold text-gray-500 uppercase ml-1">Units</label>
                <input name="description" class="w-full border-2 border-slate-100 p-3 rounded-xl mt-1 focus:border-blue-500 outline-none" placeholder="e.g. Glasses, Liters, kg" />
              </div>

              <div class="flex flex-col gap-3 pt-4">
                <button type="submit" class="w-full bg-blue-600 text-white py-4 rounded-xl font-black text-lg shadow-lg shadow-blue-100">Save Tracker</button>
                <button type="button" onClick$={() => isModalOpen.value = false} class="py-2 text-gray-400 font-medium text-sm">Dismiss</button>
              </div>
            </Form>
          </div>
        </div>
      )}
    </div>
  );
});