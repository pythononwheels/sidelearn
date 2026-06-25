#!/usr/bin/env python3
"""Ad-hoc: report the Social-Stream pool distribution (total / rubrik / CEFR band),
replicating the client-side tootBand logic so it matches what users see."""
import json, re, urllib.parse, urllib.request
from collections import Counter, defaultdict

API = "https://api.sidelearn.pyrates.io/stream"
ORIGIN = "https://learny.pyrates.io"
BANDS = ["A1", "A2", "B1", "B2", "C1", "C2", "?"]
THRESH = [("A1", 750), ("A2", 1500), ("B1", 3000), ("B2", 6000), ("C1", 12000)]
WORD = re.compile(r"[^\W\d_]+", re.UNICODE)  # ~ \p{L}+


def band_of(rank):
    for b, bound in THRESH:
        if rank <= bound:
            return b
    return "C2"


def norm(w):
    w = w.lower()
    i, j = 0, len(w)
    while i < j and not w[i].isalpha(): i += 1
    while j > i and not w[j - 1].isalpha(): j -= 1
    return w[i:j]


def toot_band(content, ranks):
    rs = []
    for w in WORD.findall(content.lower()):
        if len(w) < 3:
            continue
        r = ranks.get(norm(w))
        if r is not None:
            rs.append(r)
    if len(rs) < 4:
        return "?"
    rs.sort()
    return band_of(rs[int(len(rs) * 0.8)])


def fetch_all(lang):
    out, before = [], None
    while True:
        url = f"{API}?lang={lang}&limit=100" + (f"&before={urllib.parse.quote(before)}" if before else "")
        req = urllib.request.Request(url, headers={"Origin": ORIGIN})
        toots = json.load(urllib.request.urlopen(req))["toots"]
        out += toots
        if len(toots) < 100:
            break
        before = toots[-1]["created_at"]
    return out


for lang in ["fr", "en"]:
    ranks = json.load(open(f"src/public/data/freq-{lang}.json"))
    toots = fetch_all(lang)
    maxlen = max((len(t["content"]) for t in toots), default=0)
    print(f"\n===== {lang.upper()} — total {len(toots)} toots (max content {maxlen} chars) =====")
    per_rubrik = Counter(t["rubrik"] for t in toots)
    per_band = Counter()
    matrix = defaultdict(Counter)
    for t in toots:
        b = toot_band(t["content"], ranks)
        per_band[b] += 1
        matrix[t["rubrik"]][b] += 1
    print("per rubrik :", {k: per_rubrik[k] for k in sorted(per_rubrik)})
    print("per band   :", {k: per_band[k] for k in BANDS if per_band[k]})
    print("matrix (rubrik × band):")
    print("  " + "rubrik".ljust(12) + "".join(b.rjust(5) for b in BANDS))
    for rub in sorted(matrix):
        print("  " + rub.ljust(12) + "".join(str(matrix[rub][b] or "").rjust(5) for b in BANDS))
