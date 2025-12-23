import { component$, useSignal } from '@builder.io/qwik';
import { Link } from '@builder.io/qwik-city';
import type { MenuItem } from './menu.config';

export const DropdownMenu = component$(
  ({ items, level = 0 }: { items: MenuItem[]; level?: number }) => {
    const openIndex = useSignal<number | null>(null);

    return (
      <ul class={level === 0 ? 'py-1' : 'ml-2 border-l'}>
        {items.map((item, index) => {
          const isOpen = openIndex.value === index;

          return (
            <li key={item.label}>
              {/* LEAF NODE */}
              {item.href ? (
                <Link
                  href={item.href}
                  class="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  {item.label}
                </Link>
              ) : (
                <>
                  {/* PARENT LABEL (CLICK TO TOGGLE) */}
                  <button
                    type="button"
                    onClick$={() =>
                      (openIndex.value =
                        openIndex.value === index ? null : index)
                    }
                    class="w-full flex justify-between items-center px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                  >
                    <span>{item.label}</span>
                    <span class="text-xs">
                      {isOpen ? '▲' : '▼'}
                    </span>
                  </button>

                  {/* CHILDREN (ONLY WHEN OPEN) */}
                  {isOpen && item.children && (
                    <DropdownMenu
                      items={item.children}
                      level={level + 1}
                    />
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
    );
  }
);
