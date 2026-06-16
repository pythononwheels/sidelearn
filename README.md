# Sidelearn

> Read foreign-language web pages with inline, CEFR-aware reading help —
> powered entirely by a **local** LLM (LM Studio). Nothing leaves your machine.

Sidelearn is a Manifest V3 browser extension for learning **French, German,
English or Dutch** by reading real pages. Words above your level are gently highlighted; hover for
an instant translation; ask the local model for deeper explanations or paragraph
translations — only when you want them.

**Design principle:** *we assist, we don't dominate.* Easy words recede, only
the challenging ones stand out, and the AI runs only on an explicit click.

## Quick start

```bash
npm install
npm run dev        # Chrome, hot reload
# or
npm run build      # -> .output/chrome-mv3  (Load unpacked in chrome://extensions)
```

You also need [LM Studio](https://lmstudio.ai) running its local server
(`http://localhost:1234`) with a model loaded — start with **Gemma 3n E2B**.

See **[doc/user/README.md](doc/user/README.md)** for the full guide and
**[doc/tech/architecture.md](doc/tech/architecture.md)** for how it works.

## The escalation ladder

| Stage | Trigger | Source | LLM? |
|------:|---------|--------|:----:|
| 1 | word detected | frequency band | no |
| 2 | hover | local dictionary | no |
| 3 | "more" | LM Studio → panel | yes |
| 4 | select paragraph | LM Studio → panel | yes |

## Tech stack

TypeScript · [WXT](https://wxt.dev) (MV3) · Preact · plain CSS design tokens ·
Vitest · LM Studio (OpenAI-compatible local API).

## Scripts

| Command | What |
|---------|------|
| `npm run dev` | Dev build with hot reload (Chrome) |
| `npm run build` | Production build |
| `npm test` | Run unit tests |
| `npm run compile` | Type-check |
| `npm run data:wordlists` | (Re)generate frequency + dictionary data |

## License

MIT — see [LICENSE](LICENSE).
