import { component$, useSignal } from '@builder.io/qwik';
import { routeAction$, routeLoader$, Form } from '@builder.io/qwik-city';
import { useUserLoader } from '../layout';

const BACKEND_URL =
  import.meta.env.PUBLIC_BACKEND_URL || 'http://localhost:3000';

/* ---------------------------------
   LOAD CARDS (user-scoped)
--------------------------------- */
export const useCardsLoader = routeLoader$(async ({ resolveValue }) => {
  const user = await resolveValue(useUserLoader);
  if (!user) return [];

  const res = await fetch(
    `${BACKEND_URL}/api/cards?userId=${user.id}`,
    { cache: 'no-store' }
  );

  if (!res.ok) return [];

  const json = await res.json();
  return json.data || [];
});

/* ---------------------------------
   ACTION (NO resolveValue here)
--------------------------------- */
export const useManageCard = routeAction$(async (data) => {
  const methodMap: Record<string, string> = {
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
    body:
      data.intent !== 'delete'
        ? JSON.stringify(data)
        : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('Cards API failed:', text);
    throw new Error('Action failed');
  }

  return { success: true };
});

/* ---------------------------------
   COMPONENT
--------------------------------- */
export default component$(() => {
  const cards = useCardsLoader();
  const manageAction = useManageCard();
  const editingId = useSignal<number | null>(null);
  const user = useUserLoader(); // ✅ SAFE HERE
const showDecrementFor = useSignal<number | null>(null);

  if (!user.value) {
    return <p class="p-6">Please log in</p>;
  }

  return (
    <div class="min-h-screen bg-slate-50 p-6">
      <div class="max-w-3xl mx-auto">
        <h1 class="text-2xl font-black mb-8 text-blue-600">
          CARD MANAGER ({cards.value.length})
        </h1>

        {/* CREATE */}
        <div class="bg-white p-5 rounded-xl mb-8">
          <Form action={manageAction} class="flex gap-2">
            <input type="hidden" name="intent" value="add" />
            <input type="hidden" name="userId" value={user.value.id} />
            <input name="title" required class="border p-2 flex-1" />
            <input name="description" class="border p-2 flex-1" />
            <button class="bg-blue-600 text-white px-4">Add</button>
          </Form>
        </div>

        {/* LIST */}
        {cards.value.map((card: any) => (
          <div key={card.id} class="bg-white p-4 mb-3 rounded-xl">
            {editingId.value === card.id ? (
              <Form action={manageAction}>
                <input type="hidden" name="intent" value="edit" />
                <input type="hidden" name="id" value={card.id} />
                <input type="hidden" name="userId" value={user.value.id} />
                <input name="title" defaultValue={card.title} />
                <input name="description" defaultValue={card.description} />
                <button>Save</button>
              </Form>
            ) : (
              <>
  {/* CARD TITLE */}
  <h3 class="text-lg font-bold text-center mb-3">
    {card.title}
  </h3>

  {/* COUNTER ROW */}
  <div class="relative flex items-center justify-center gap-6 my-4">

    {/* LEFT AREA (tap to reveal decrement) */}
    <div
      class="w-12 h-12 flex items-center justify-center cursor-pointer"
      onClick$={() =>
        (showDecrementFor.value =
          showDecrementFor.value === card.id ? null : card.id)
      }
    >
      {showDecrementFor.value === card.id && (
        <Form action={manageAction}>
          <input type="hidden" name="intent" value="decrement" />
          <input type="hidden" name="id" value={card.id} />
          <input type="hidden" name="userId" value={user.value.id} />
          <button class="text-3xl font-bold text-red-600">
            −
          </button>
        </Form>
      )}
    </div>

    {/* COUNTER NUMBER */}
    <span class="text-4xl font-black text-gray-800">
      {card.counter}
    </span>

    {/* INCREMENT BUTTON (always visible) */}
    <Form action={manageAction}>
      <input type="hidden" name="intent" value="increment" />
      <input type="hidden" name="id" value={card.id} />
      <input type="hidden" name="userId" value={user.value.id} />
      <button class="text-3xl font-bold text-green-600">
        +
      </button>
    </Form>
  </div>

  {/* DESCRIPTION */}
  {card.description && (
    <p class="text-center text-sm text-gray-600 mt-2">
      {card.description}
    </p>
  )}

  {/* ACTIONS */}
  <div class="flex justify-center gap-4 mt-4">
    <button
      class="text-blue-600 text-sm"
      onClick$={() => (editingId.value = card.id)}
    >
      Edit
    </button>

    <Form action={manageAction}>
      <input type="hidden" name="intent" value="delete" />
      <input type="hidden" name="id" value={card.id} />
      <input type="hidden" name="userId" value={user.value.id} />
      <button class="text-red-600 text-sm">
        Delete
      </button>
    </Form>
  </div>
</>

            )}
          </div>
        ))}
      </div>
    </div>
  );
});
