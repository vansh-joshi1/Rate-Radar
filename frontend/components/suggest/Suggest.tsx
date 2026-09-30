'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';

/*
 * The one search-as-you-type combobox, shared by the onboarding address field
 * and the watchlist search (components/CompetitorInsights.tsx). The hook owns
 * the debounce, the abort of a superseded request, and the open / highlighted
 * state; each caller keeps its own keyboard rules and row rendering.
 *
 * `name` keys the ARIA ids: `${name}-suggestions` and `${name}-option-${i}`.
 */

export function useSuggest<T>(
  name: string,
  /** Resolves to the rows, or null to keep whatever is showing. */
  fetchRows: (q: string, signal: AbortSignal) => Promise<T[] | null>,
  { delay, openEmpty = false }: { delay: number; openEmpty?: boolean },
) {
  const [items, setItems] = useState<T[]>([]);
  const [open, setOpen] = useState(false);
  /** Highlighted row for arrow-key navigation; -1 is none. */
  const [active, setActive] = useState(-1);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      abort.current?.abort();
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function search(v: string) {
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 3) {
      setItems([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setSearching(true);
      try {
        const rows = await fetchRows(v.trim(), ctrl.signal);
        if (rows) {
          setItems(rows);
          setActive(-1);
          setOpen(openEmpty || rows.length > 0);
        }
      } catch {
        /* aborted or offline: keep whatever we had */
      } finally {
        setSearching(false);
      }
    }, delay);
  }

  /** Arrow-key step through the rows, wrapping at both ends. */
  const move = (dir: 1 | -1) =>
    setActive((i) => (dir === 1 ? (i + 1) % items.length : i <= 0 ? items.length - 1 : i - 1));

  const inputProps = {
    role: 'combobox' as const,
    'aria-expanded': open,
    // The listbox only exists while open; pointing at a missing id is an ARIA error.
    'aria-controls': open ? `${name}-suggestions` : undefined,
    'aria-autocomplete': 'list' as const,
    'aria-activedescendant': open && active >= 0 ? `${name}-option-${active}` : undefined,
    onFocus: () => items.length > 0 && setOpen(true),
    onBlur: () => setTimeout(() => setOpen(false), 150),
  };

  return { name, items, setItems, open, setOpen, active, setActive, searching, search, move, inputProps };
}

/** The dropdown under the field. `children` render before the rows (status lines). */
export function SuggestList<T>({
  s,
  itemKey,
  onPick,
  optionClass = '',
  disabled,
  title,
  children,
  render,
}: {
  s: ReturnType<typeof useSuggest<T>>;
  itemKey: (item: T) => string;
  onPick: (item: T) => void;
  optionClass?: string;
  disabled?: boolean;
  title?: string;
  children?: ReactNode;
  render: (item: T) => ReactNode;
}) {
  if (!s.open) return null;
  return (
    <ul
      id={`${s.name}-suggestions`}
      role="listbox"
      className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-[1.25rem] bg-white p-1.5 shadow-[0_24px_48px_-24px_rgba(11,28,48,0.35)] ring-1 ring-[#0b1c30]/[0.08]"
    >
      {children}
      {s.items.map((item, i) => (
        <li key={itemKey(item)} id={`${s.name}-option-${i}`} role="option" aria-selected={i === s.active}>
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            title={title}
            onMouseDown={(e) => e.preventDefault() /* keep focus until click fires */}
            onClick={() => onPick(item)}
            onMouseEnter={() => s.setActive(i)}
            className={`w-full rounded-[0.875rem] px-4 py-2.5 text-left transition-colors duration-150 hover:bg-[#f3f5fc] ${optionClass} ${
              i === s.active ? 'bg-[#f3f5fc]' : ''
            }`}
          >
            {render(item)}
          </button>
        </li>
      ))}
    </ul>
  );
}
