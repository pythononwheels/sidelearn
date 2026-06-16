/**
 * Extract a small palette from the live page so the panel can blend in with it.
 *
 * We read the page's own background and text colors (so contrast is preserved)
 * and derive a slightly elevated surface + a subtle border from them. Falls back
 * to null when the page background is non-solid (image/gradient/transparent).
 */

import type { PageTheme } from '@/core/theme';

type Rgb = [number, number, number];

export function extractPageTheme(): PageTheme | null {
  const bg = firstOpaqueBg();
  if (!bg) return null;

  const text = parseRgb(getComputedStyle(document.body).color) ?? [42, 42, 40];
  const light = luminance(bg) > 0.5;
  const contrast: Rgb = light ? [0, 0, 0] : [255, 255, 255];

  const surface = light ? mix(bg, [255, 255, 255], 0.55) : mix(bg, [255, 255, 255], 0.07);
  const border = mix(bg, contrast, 0.13);
  const textSoft = mix(text, bg, 0.4);

  return {
    bg: css(bg),
    surface: css(surface),
    border: css(border),
    text: css(text),
    textSoft: css(textSoft),
  };
}

function firstOpaqueBg(): Rgb | null {
  for (const el of [document.body, document.documentElement]) {
    if (!el) continue;
    const c = parseRgba(getComputedStyle(el).backgroundColor);
    if (c && c[3] !== 0) return [c[0], c[1], c[2]];
  }
  return null;
}

function parseRgba(s: string): [number, number, number, number] | null {
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1]!.split(',').map((p) => parseFloat(p.trim()));
  if (parts.length < 3 || parts.slice(0, 3).some((n) => Number.isNaN(n))) return null;
  return [parts[0]!, parts[1]!, parts[2]!, parts[3] ?? 1];
}

function parseRgb(s: string): Rgb | null {
  const c = parseRgba(s);
  return c ? [c[0], c[1], c[2]] : null;
}

const luminance = ([r, g, b]: Rgb) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

function mix(c: Rgb, target: Rgb, t: number): Rgb {
  return [
    Math.round(c[0] + (target[0] - c[0]) * t),
    Math.round(c[1] + (target[1] - c[1]) * t),
    Math.round(c[2] + (target[2] - c[2]) * t),
  ];
}

const css = ([r, g, b]: Rgb) => `rgb(${r}, ${g}, ${b})`;
