/**
 * Learny themes. Each id maps to a [data-theme="…"] palette block in app.css.
 * The theme is authoritative (independent of the OS light/dark setting).
 */

export type ThemeId = 'warm' | 'mint' | 'neon' | 'bright' | 'paper';

export interface Theme {
  id: ThemeId;
  name: string;
  dots: [string, string]; // two accent dots for the switcher preview
  bg: string; // swatch background for the switcher card
}

export const THEMES: Theme[] = [
  { id: 'warm', name: 'Warm', dots: ['#ff7a66', '#2a7e8c'], bg: '#faf3ea' },
  { id: 'mint', name: 'Fresh', dots: ['#16b386', '#3fbfe2'], bg: '#ffffff' },
  { id: 'neon', name: 'Neon', dots: ['#4be3c0', '#b388ff'], bg: '#0f1422' },
  { id: 'bright', name: 'Pop', dots: ['#58cc52', '#ffc83d'], bg: '#fffdf4' },
  { id: 'paper', name: 'Paper', dots: ['#c65d3b', '#3f6b5e'], bg: '#f7f1e8' },
];

export function applyTheme(id: ThemeId): void {
  document.documentElement.dataset.theme = id;
}
