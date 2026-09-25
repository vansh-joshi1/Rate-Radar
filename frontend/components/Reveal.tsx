'use client';

import { useEffect, useRef, useState } from 'react';

/*
 * Enter-on-scroll for the landing page, driven by IntersectionObserver rather
 * than a scroll listener. It sets `data-shown` on its own element; the element
 * and its children style both states in CSS (`.reveal` in globals.css, plus
 * `group-data-[shown=false]/reveal:` variants for things like a gauge fill).
 *
 * The attribute is absent until hydration, and absent means "shown", so the
 * content is readable with no JS. Anything already in the viewport at mount is
 * marked shown immediately instead of being hidden and brought back.
 */
export default function Reveal({
  children,
  className = '',
  delay = 0,
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  /** `li` when the revealed element is itself a list item. */
  as?: 'div' | 'li';
}) {
  const ref = useRef<HTMLDivElement & HTMLLIElement>(null);
  const [shown, setShown] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rect = el.getBoundingClientRect();
    if (reduced || rect.top < window.innerHeight * 0.9) {
      setShown(true);
      return;
    }
    setShown(false);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        io.disconnect();
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      data-shown={shown === undefined ? undefined : String(shown)}
      className={`reveal group/reveal ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
