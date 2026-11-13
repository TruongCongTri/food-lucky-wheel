/**
 * Inline SVG stand-ins for symbol characters ("↗", "↻").
 *
 * Those glyphs aren't in the web fonts, so the first time one appears the
 * browser searches the system fonts for a fallback. On phones that lookup
 * cost ~200 ms of layout right when the result popup opens, which made the
 * reveal stutter. SVGs need no font. Sized in em so they follow the text.
 */
type Props = { className?: string };

/** Sits on the text baseline like the glyph it replaces. */
const ICON_STYLE = { verticalAlign: "-0.125em", flexShrink: 0 } as const;

export function ArrowUpRight({ className }: Props) {
  return (
    <svg className={className} width="0.9em" height="0.9em" viewBox="0 0 24 24" aria-hidden focusable="false" style={ICON_STYLE}>
      <path d="M7 17 17 7M8 7h9v9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SpinAgain({ className }: Props) {
  return (
    <svg className={className} width="1em" height="1em" viewBox="0 0 24 24" aria-hidden focusable="false" style={ICON_STYLE}>
      <path
        d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4v4h-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
