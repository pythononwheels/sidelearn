# Data

LangLearn needs two local datasets per language, bundled into the extension and
fetched at runtime from `public/data/`:

| File | Purpose | Stage |
|------|---------|------:|
| `freq-<lang>.json` | `{ word: rank }` — frequency rank → CEFR band | 1 |
| `dict-<lang>.json`  | `{ headword: DictSense[] }` — bilingual senses | 2 |

The files committed to `public/data/` are **small hand-made samples** so the
extension runs immediately after cloning. Replace them with full data via the
generator.

## Generating the full data

```bash
npm run data:wordlists
```

`scripts/build-wordlists.mjs` (re)builds the JSON from open sources. Downloaded
source files go to `data/sources/` (gitignored).

### Sources & licenses

- **Frequency** — [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords)
  (OpenSubtitles frequency lists, CC-BY-SA). FR and NL both available.
- **Dictionary** — [FreeDict](https://freedict.org/) `fra-deu` / `nld-deu`
  (GPL / CC). Parsed from the `.dict`/`.index` format.
- **Future (FR only)** — [FLELex](http://cental.uclouvain.be/flelex/) for a
  proper CEFR-graded French lexicon (research use).

Keep large generated files out of git — regenerate them locally instead.
