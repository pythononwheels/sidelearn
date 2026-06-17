/**
 * Small inline line-icons (Lucide-style, 24-grid, stroked with `currentColor`
 * so they inherit text colour). Kept as tiny components instead of an icon font
 * or sprite — no extra assets, perfectly crisp, themeable via CSS `color`.
 */

import type { JSX } from 'preact';

interface IconProps {
  class?: string;
  size?: number;
}

function svgProps(size: number): JSX.SVGAttributes<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 2,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  };
}

/** Concentric target — daily challenge / accuracy. */
export function TargetIcon({ class: cls, size = 16 }: IconProps) {
  return (
    <svg class={cls} {...svgProps(size)}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

/** Flame — streak. */
export function FlameIcon({ class: cls, size = 16 }: IconProps) {
  return (
    <svg class={cls} {...svgProps(size)}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}

/** Open book — learn mode. */
export function BookIcon({ class: cls, size = 16 }: IconProps) {
  return (
    <svg class={cls} {...svgProps(size)}>
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </svg>
  );
}

/** Compass — surf mode. */
export function CompassIcon({ class: cls, size = 16 }: IconProps) {
  return (
    <svg class={cls} {...svgProps(size)}>
      <circle cx="12" cy="12" r="10" />
      <path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
    </svg>
  );
}

/** House — back to the landing chooser. */
export function HomeIcon({ class: cls, size = 16 }: IconProps) {
  return (
    <svg class={cls} {...svgProps(size)}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </svg>
  );
}

/** Star — bookmark (filled when active). */
export function StarIcon({ class: cls, size = 16, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg class={cls} {...svgProps(size)} fill={filled ? 'currentColor' : 'none'}>
      <path d="M11.5 2.6a.6.6 0 0 1 1 0l2.5 5.1 5.6.8a.6.6 0 0 1 .3 1l-4 4 1 5.6a.6.6 0 0 1-.9.6L12 17.6l-5 2.7a.6.6 0 0 1-.9-.6l1-5.6-4-4a.6.6 0 0 1 .3-1l5.6-.8z" />
    </svg>
  );
}

/** Languages — translate page. */
export function LanguagesIcon({ class: cls, size = 16 }: IconProps) {
  return (
    <svg class={cls} {...svgProps(size)}>
      <path d="m5 8 6 6" />
      <path d="m4 14 6-6 2-3" />
      <path d="M2 5h12" />
      <path d="M7 2h1" />
      <path d="m22 22-5-10-5 10" />
      <path d="M14 18h6" />
    </svg>
  );
}

/** Question mark in a circle — quiz. */
export function QuizIcon({ class: cls, size = 16 }: IconProps) {
  return (
    <svg class={cls} {...svgProps(size)}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

/** Speech bubble — chat. */
export function ChatIcon({ class: cls, size = 16 }: IconProps) {
  return (
    <svg class={cls} {...svgProps(size)}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
    </svg>
  );
}

/** Trophy — achievements. */
export function TrophyIcon({ class: cls, size = 16 }: IconProps) {
  return (
    <svg class={cls} {...svgProps(size)}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}
