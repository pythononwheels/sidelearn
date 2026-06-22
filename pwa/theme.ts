/**
 * Learny themes. Each id maps to a [data-theme="…"] palette block in app.css.
 * The theme is authoritative (independent of the OS light/dark setting).
 */

export type ThemeId = 'jelly' | 'knister' | 'comic';

export interface Theme {
  id: ThemeId;
  name: string;
  dots: [string, string]; // two accent dots for the switcher preview
  bg: string; // swatch background for the switcher card
}

export const THEMES: Theme[] = [
  { id: 'jelly', name: 'Jelly', dots: ['#ff6b9d', '#7c5cfc'], bg: '#fdf3f8' },
  { id: 'knister', name: 'Knister', dots: ['#ff6b5e', '#38d9a9'], bg: '#fff7ec' },
  { id: 'comic', name: 'Comic', dots: ['#ff3b3b', '#2d7dff'], bg: '#fffdf5' },
];

export const THEME_IDS = THEMES.map((t) => t.id);
export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === 'string' && (THEME_IDS as string[]).includes(v);
}

export function applyTheme(id: ThemeId): void {
  document.documentElement.dataset.theme = id;
}
