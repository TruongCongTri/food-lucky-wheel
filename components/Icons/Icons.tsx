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

const filled = (d: string) =>
  function Icon({ className }: Props) {
    return (
      <svg className={className} width="1em" height="1em" viewBox="0 0 24 24" aria-hidden focusable="false" style={ICON_STYLE}>
        <path d={d} fill="currentColor" />
      </svg>
    );
  };

export const PlayIcon = filled("M8 5.5v13a1 1 0 0 0 1.5.86l10.6-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z");
export const PauseIcon = filled("M7 5h3.2v14H7zM13.8 5H17v14h-3.2z");
export const NextIcon = filled("M5 6.2v11.6a.9.9 0 0 0 1.4.75L15 12.75a.9.9 0 0 0 0-1.5L6.4 5.45A.9.9 0 0 0 5 6.2ZM16.6 5H19v14h-2.4z");
export const PrevIcon = filled("M19 6.2v11.6a.9.9 0 0 1-1.4.75L9 12.75a.9.9 0 0 1 0-1.5l8.6-5.8A.9.9 0 0 1 19 6.2ZM5 5h2.4v14H5z");
export const RepeatOneIcon = filled("M17 3l4 4-4 4V8H7a1 1 0 0 0-1 1v3H4V9a3 3 0 0 1 3-3h10V3Zm-10 18-4-4 4-4v3h10a1 1 0 0 0 1-1v-3h2v3a3 3 0 0 1-3 3H7v3Zm4.2-5.5V10.8l-1.3.5V10l2-.9h.9v6.4h-1.6Z");
export const RepeatAllIcon = filled("M17 3l4 4-4 4V8H7a1 1 0 0 0-1 1v3H4V9a3 3 0 0 1 3-3h10V3ZM7 21l-4-4 4-4v3h10a1 1 0 0 0 1-1v-3h2v3a3 3 0 0 1-3 3H7v3Z");
