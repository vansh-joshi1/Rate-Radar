/**
 * Material Symbols glyph.
 *
 * `data-weight="fill"` is the only switch with a CSS rule behind it — see
 * `globals.css`, where it sets `font-variation-settings: 'FILL' 1`. Two files
 * previously carried a private copy of this component that wrote
 * `className="fill"` instead, which matches no rule and no Tailwind utility;
 * neither happened to pass `fill`, so the breakage never surfaced. One
 * component means it cannot come back.
 */
export default function Icon({
  name,
  fill = false,
  className = '',
}: {
  name: string;
  fill?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      {...(fill ? { 'data-weight': 'fill' } : {})}
      aria-hidden
    >
      {name}
    </span>
  );
}
