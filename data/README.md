# Data

LangLearn supports four languages (fr, de, en, nl); native and learning language
are chosen at onboarding. Two kinds of dataset are bundled and fetched at runtime
from `src/public/data/`:

| File | Purpose | Stage |
|------|---------|------:|
| `freq-<learn>.json` | `{ word: rank }` — frequency rank → CEFR band (one per language) | 1 |
| `dict-<learn>-<native>.json` | `{ headword: DictSense[] }` — directed bilingual senses | 2 |

Dictionaries are **directed** (learning → native), so e.g. `dict-fr-de.json`
serves a German speaker learning French. Pairs FreeDict doesn't publish simply
aren't bundled — at runtime the hover then shows the frequency band only and the
"more" button falls back to the local LLM. Nothing breaks.

The files committed to `src/public/data/` are **real generated data** (≈7 MB
total: top-20k frequency ranks per language + FreeDict dictionaries filtered to
the top-50k vocabulary), so the extension works immediately after cloning.
Regenerate them with the command below when sources update.

## Generating the full data

```bash
npm run data:wordlists
```

`scripts/build-wordlists.mjs` (re)builds the JSON from open sources. Downloaded
source files go to `data/sources/` (gitignored).

### Sources & licenses

- **Frequency** — [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords)
  (OpenSubtitles frequency lists, CC-BY-SA). fr/de/en/nl all available; we bundle
  the top `TOP_N` (default 20k) per language.
- **Dictionary** — [FreeDict](https://freedict.org/) directed pairs (e.g.
  `fra-deu`, `eng-deu`, `nld-deu`, `deu-eng`…) (GPL / CC). Parsed from the
  `.dict`/`.index` format. See `DICT_PAIRS` in the generator.
- **Future (FR only)** — [FLELex](http://cental.uclouvain.be/flelex/) for a
  proper CEFR-graded French lexicon (research use).

Keep large generated files out of git — regenerate them locally instead.
