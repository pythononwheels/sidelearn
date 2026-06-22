/**
 * Tiny dependency-free confetti. `pop()` is a small burst for correct answers;
 * `celebrate()` is a bigger fall for milestones (daily goal, passed test). Uses
 * the Web Animations API (auto-cleaned) and honours prefers-reduced-motion.
 * Deliberately restrained — a little delight, not a parade.
 */

const COLORS = ['#ff7a59', '#ffd166', '#06d6a0', '#4d96ff', '#c77dff'];

function reduced(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function piece(x: number, y: number, dx: number, dy: number, life: number, size: number): void {
  const el = document.createElement('div');
  const color = COLORS[Math.floor(Math.random() * COLORS.length)]!;
  const round = Math.random() < 0.5;
  el.style.cssText =
    `position:fixed;left:${x}px;top:${y}px;width:${size}px;height:${size * (round ? 1 : 0.5)}px;` +
    `background:${color};border-radius:${round ? '50%' : '1px'};pointer-events:none;z-index:9999;will-change:transform,opacity`;
  document.body.appendChild(el);
  const rot = Math.random() * 720 - 360;
  const anim = el.animate(
    [
      { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
      { transform: `translate(${dx * 0.5}px,${dy * 0.4 - 24}px) rotate(${rot * 0.5}deg)`, opacity: 1, offset: 0.4 },
      { transform: `translate(${dx}px,${dy}px) rotate(${rot}deg)`, opacity: 0 },
    ],
    { duration: life, easing: 'cubic-bezier(.2,.7,.3,1)' },
  );
  anim.onfinish = () => el.remove();
  anim.oncancel = () => el.remove();
}

/** Small celebratory burst around a point (e.g. a correct answer). */
export function pop(x: number, y: number, n = 12): void {
  if (reduced()) return;
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n + Math.random() * 0.5;
    const dist = 50 + Math.random() * 60;
    piece(x, y, Math.cos(angle) * dist, Math.sin(angle) * dist + 40, 650 + Math.random() * 250, 7 + Math.random() * 4);
  }
}

/** Bigger confetti fall from the top for milestones. */
export function celebrate(): void {
  if (reduced()) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  let wave = 0;
  const fire = () => {
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * w;
      piece(x, -12, (Math.random() - 0.5) * 120, h + 40, 1400 + Math.random() * 800, 8 + Math.random() * 5);
    }
    if (++wave < 3) setTimeout(fire, 180);
  };
  fire();
}
