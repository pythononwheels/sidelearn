# LangLearn — User Guide

LangLearn helps you read web pages in a language you're learning (French or
Dutch) with German reading aids. Everything runs **locally** — the AI lives on
your own machine via [LM Studio](https://lmstudio.ai), nothing is sent to the cloud.

## Setup

1. **Install LM Studio** and download a model (start with **Gemma 3n E2B**).
2. In LM Studio, start the **local server** (Developer tab → Start Server).
   It listens on `http://localhost:1234` by default.
3. Load the extension in Chrome:
   - `npm install && npm run build`
   - Open `chrome://extensions`, enable **Developer mode**,
     **Load unpacked**, select the `.output/chrome-mv3` folder.

## Using it

1. Click the LangLearn toolbar icon to open the side panel.
2. Pick your **language** (Französisch / Niederländisch) and your **level**
   (A1–C2). Words harder than your level get marked on the page.
3. **Hover** a marked word → a small card shows its level and translation.
4. Click **"mehr in der Sidebar"** for a fuller explanation (examples,
   synonyms, grammar) — this asks the local model.
5. **Paste or select a paragraph** in the panel → "übersetzen" gives you a
   German translation beneath it.

The panel header shows whether LM Studio is connected.

## Tips

- The inline marking can be toggled off in the panel if a site's layout reacts
  badly to it — all features remain available from the panel.
- Easy words stay light grey on purpose; only the words *above* your level are
  emphasised, so your eye goes where the learning is.
