# Learny — Design Language

Warm, friendly, calm. A daily reading habit should feel light and encouraging,
never like a tool or a test. Light-first, with a soft warm dark mode (never harsh
black). Tone: German, "du", warm, no pressure ("Kein Stress — …").

> Note: this is **Learny's own** look. The Sidelearn browser extension keeps its
> violet/neutral theme; Learny is the warm y-app in the pyrates family.

## Color roles

Defined as CSS variables in `pwa/app.css` (overriding the shared tokens for
Learny only). Use **roles**, never raw hex, in components.

### Light (default)
| Role | Var | Hex | Use |
|---|---|---|---|
| Canvas | `--ll-bg` | `#faf3ea` | page background (warm cream) |
| Surface | `--ll-surface` | `#fffdf9` | cards, list items, pills |
| Border | `--ll-border` | `#ece1d2` | hairlines, card outlines |
| Text | `--ll-text` | `#2c2521` | primary text |
| Text soft | `--ll-text-soft` | `#7c7064` | secondary text |
| Text muted | `--ll-text-muted` | `#b6a999` | hints, disabled |
| **Accent (coral)** | `--ll-accent` | `#ff7a66` | primary actions, brand |
| Accent strong | `--ll-accent-strong` | `#ee5d46` | accent text, pressed |
| Accent soft | `--ll-accent-soft` | coral @13% | tinted backgrounds (hero, chips) |
| **Petrol** (2nd) | `--lr-petrol` | `#2a7e8c` | secondary accent, progress, placeholders |
| Success | `--lr-ok` | `#2f9e6b` | done states, correct answers |

### Dark (soft, warm — not black)
Canvas `#211b18`, Surface `#2b231f`, Border `#3c322d`, Text `#f4ece3`,
Accent `#ff8a73`, Petrol `#4fb3c2`, Success `#54c08a`.

### Usage rules
- **One primary action per screen** in coral. Everything else is surface/ghost.
- Coral = "do this / move forward". Petrol = supportive/secondary (progress,
  thumbnails, info). Green only for success/correct.
- Tinted backgrounds use `accent-soft` (hero), never full coral blocks except the
  primary button.

## Typography
System font stack. Sizes: 13 (meta) · 14 (labels) · 15–16 (body) · 17 (lead/CTA)
· 20 (lesson text) · 26 (onboarding H1). Weights: 600 / 700 / 800 (headlines &
buttons are 800). Reading line-height 1.5–1.6.

## Shape & depth
- Radii: `--ll-radius-sm` 10 · `--ll-radius` 16 · cards/hero 18–22 · pills 999.
- Shadow: one soft warm elevation `--ll-shadow` (cards/CTA only, sparingly).
- Spacing: 8-based (8/10/12/14/16/20/22).

## Components
- **Primary button (CTA):** coral bg, white text, radius 16, soft shadow, full
  width, weight 800. Active: slight translate/scale.
- **Ghost/secondary:** surface bg, 1px border, accent text.
- **Pill selectors** (language/level): surface, border, radius 999.
- **Card:** surface + border, radius 16–22. **Hero card:** `accent-soft` bg.
- **List item:** surface card, thumbnail (or petrol letter placeholder), title +
  one-line teaser, trailing action (`lesen ›` / `✓`). Next-to-read item = primary
  (coral tint + `Start ›`).
- **Chips/tags:** small pill; level tag uses `accent-soft`.
- **Progress bar:** track `--ll-bg`, fill petrol (neutral progress) or coral
  (today's goal).
- **Spinner:** three bouncing accent dots.

## Motion
Subtle only: 0.05–0.2s ease on press (scale/translate), opacity for past
paragraphs. No flashy animations.

## Voice
Encouraging, brief, "du". Examples: "Willkommen bei Learny 👋", "Los geht's",
"Kein Stress — du kannst das Niveau jederzeit ändern.", "Heute geschafft 🎉".
Avoid streak-shaming; gamification stays gentle and optional.
