"""Minimal server-rendered admin dashboard to discover + process daily content.

Mutating actions are POST (so crawlers can't trigger them); protect /admin* with
Caddy basicauth in front. No build step — plain HTML + a little inline CSS.
"""

from datetime import date
from html import escape

from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import HTMLResponse, RedirectResponse

from . import config, db, pipeline

router = APIRouter()

CSS = """
:root{
  --bg:#faf7f5;--surface:#ffffff;--border:#e7e1dc;--text:#2c2a30;--muted:#8a8590;
  --accent:#6b57d6;--accent2:#9a7af0;--soft:rgba(107,87,214,.10);--ok:#2f9e6b;--warn:#c98a2e;--err:#d2603f;
  color-scheme:light dark;
}
@media(prefers-color-scheme:dark){:root{
  --bg:#191820;--surface:#23222b;--border:#36343f;--text:#eceaf2;--muted:#9b96a6;
  --accent:#9a85f0;--accent2:#b9a3ff;--soft:rgba(154,133,240,.16);--ok:#54c08a;--warn:#e0a85a;--err:#e8765a;
}}
*{box-sizing:border-box}
body{font:15px/1.5 system-ui,-apple-system,sans-serif;margin:0;background:var(--bg);color:var(--text)}
.wrap{max-width:900px;margin:0 auto;padding:20px}
a{color:var(--accent);text-decoration:none}
h1{font-size:20px}h3{margin-top:22px}
.bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0}
.tab,.lvlbtn{display:inline-block;border-radius:999px;font-weight:700;border:1px solid var(--border);color:var(--text)}
.tab{padding:4px 14px}.lvlbtn{padding:4px 14px;margin-right:6px}
.tab.on,.lvlbtn.on{background:var(--accent);color:#fff;border-color:transparent}
.lvlbtn.todo{opacity:.45}
.btn{font:inherit;font-weight:600;padding:6px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--accent);cursor:pointer}
.btn.primary{background:var(--accent);color:#fff;border-color:transparent}
.btn:disabled{opacity:.5;cursor:default}
.card{border:1px solid var(--border);background:var(--surface);border-radius:14px;padding:14px;margin:12px 0;display:flex;gap:14px}
.card img,.card .ph{width:64px;height:64px;border-radius:10px;flex:0 0 auto}
.card img{object-fit:cover}
.card .ph{background:var(--bg);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--muted)}
.lvl{display:inline-block;font-size:12px;font-weight:700;padding:1px 9px;border-radius:999px;margin-right:4px;border:1px solid var(--border);color:var(--muted)}
.lvl.done{background:var(--soft);color:var(--ok);border-color:transparent}
.muted{color:var(--muted);font-size:13px}
.day{display:inline-block;margin:3px 6px 3px 0;padding:4px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface)}
form{display:inline}
.run{color:var(--warn);font-weight:700}
.summary{background:var(--soft);border-radius:12px;padding:14px 16px;margin:14px 0;font-size:16px;line-height:1.55}
.para{display:grid;grid-template-columns:1fr 1fr;gap:18px;padding:16px 0;border-top:1px solid var(--border)}
.para .orig{color:var(--muted);font-size:14px}
.para .simp{font-size:16px;line-height:1.55}
.qbox{grid-column:1/-1;margin-top:4px;font-size:14px;color:var(--accent2)}
.qbox b{color:inherit}
@media(max-width:760px){.para{grid-template-columns:1fr}.para .orig{order:2}}
.collab{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}
.cards{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}
.kpi{border:1px solid var(--border);background:var(--surface);border-radius:12px;padding:10px 16px;min-width:110px}
.kpi b{display:block;font-size:22px}
.kpi span{color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.04em}
.statrow{display:grid;grid-template-columns:170px 1fr auto;gap:10px;align-items:center;margin:7px 0;font-size:13px}
.statlabel{font-weight:700}
.bar2{height:16px;border-radius:6px;overflow:hidden;display:flex;background:var(--border)}
.bar2 .in{background:var(--accent)}.bar2 .out{background:var(--accent2)}
.statnum{color:var(--muted);white-space:nowrap}
.legend{font-size:12px;color:var(--muted);margin:4px 0}
.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;vertical-align:middle;margin:0 4px}
table{border-collapse:collapse;width:100%;font-size:12px;margin-top:8px}
td,th{text-align:left;padding:5px 8px;border-bottom:1px solid var(--border);white-space:nowrap}
.err{color:var(--err)}
.cols{display:grid;grid-template-columns:1fr 340px;gap:28px;align-items:start}
@media(max-width:820px){.cols{grid-template-columns:1fr}}
.side{border:1px solid var(--border);background:var(--surface);border-radius:14px;padding:16px;position:sticky;top:16px}
.side h3{margin-top:0}
.side .cards{gap:8px}
.side .kpi{flex:1 1 44%;min-width:0;padding:8px 12px}
.side .kpi b{font-size:18px}
.sbar{display:grid;grid-template-columns:34px 1fr auto;gap:8px;align-items:center;font-size:12px;margin:7px 0}
.sbar .lab{font-weight:700}.sbar .c{color:var(--muted)}
.vchart{display:flex;gap:24px;align-items:flex-end;margin:12px 0 4px;flex-wrap:wrap}
.vcol{display:flex;flex-direction:column;align-items:center}
.vbar{width:54px;border-radius:7px 7px 0 0;overflow:hidden;display:flex;flex-direction:column-reverse;background:var(--border)}
.vbar .in{background:var(--accent);width:100%}
.vbar .out{background:var(--accent2);width:100%;flex:1}
.vlabel{margin-top:7px;text-align:center;font-size:12px}
.vlabel b{font-size:13px}.vlabel .c{color:var(--muted)}
.side .vchart{gap:12px;justify-content:space-between}
.side .vbar{width:30px}
.side .vlabel{font-size:11px}.side .vlabel b{font-size:12px}
"""


def page(title: str, body: str, refresh: int = 0) -> HTMLResponse:
    meta_refresh = f"<meta http-equiv=refresh content={refresh}>" if refresh else ""
    return HTMLResponse(
        f"<!doctype html><meta charset=utf-8><title>{escape(title)}</title>{meta_refresh}"
        f"<style>{CSS}</style><div class=wrap>{body}</div>"
    )


def lang_tabs(active: str, date_key: str | None = None) -> str:
    parts = []
    for lg in config.LANGS:
        href = f"/admin/day?lang={lg}&date={date_key}" if date_key else f"/admin?lang={lg}"
        cls = "tab on" if lg == active else "tab"
        parts.append(f"<a class='{cls}' href='{href}'>{lg.upper()}</a>")
    return "<div class=bar>" + "".join(parts) + "</div>"


@router.get("/admin", response_class=HTMLResponse)
def admin_home(lang: str = "fr") -> HTMLResponse:
    if lang not in config.LANGS:
        lang = config.LANGS[0]
    today = pipeline.today_key()
    dates = db.daily_dates(lang, 60)
    day_links = (
        "".join(f"<a class=day href='/admin/day?lang={lang}&date={d}'>{d}</a>" for d in dates)
        or "<span class=muted>noch keine Tage entdeckt</span>"
    )
    t = db.telemetry_totals()
    by = db.telemetry_by_fn()
    maxtok = max([r["tin"] + r["tout"] for r in by] + [1])
    sbars = []
    for r in by:
        total = r["tin"] + r["tout"]
        w = total / maxtok * 100
        inpct = (r["tin"] / total * 100) if total else 0
        sbars.append(
            f"<div class=sbar><span class=lab>{escape(r['label'].split(':')[-1])}</span>"
            f"<div class=bar2 style='width:{w:.0f}%'>"
            f"<span class=in style='width:{inpct:.0f}%'></span><span class=out style='flex:1'></span></div>"
            f"<span class=c>${r['cost']:.4f}</span></div>"
        )

    kpis = (
        "<div class=cards>"
        f"<div class=kpi><b>{t['calls']}</b><span>Calls</span></div>"
        f"<div class=kpi><b>${t['cost']:.4f}</b><span>Kosten</span></div>"
        f"<div class=kpi><b>{t['tin']:,}</b><span>Input</span></div>"
        f"<div class=kpi><b>{t['tout']:,}</b><span>Output</span></div>"
        f"<div class=kpi><b>{t['errors']}</b><span>Fehler</span></div>"
        "</div>"
    )
    bylang = db.telemetry_by_lang()
    maxl = max([r["tin"] + r["tout"] for r in bylang] + [1])
    vcols = []
    for r in bylang:
        total = r["tin"] + r["tout"]
        barpx = max(4, round(total / maxl * 120))
        inpct = (r["tin"] / total * 100) if total else 0
        vcols.append(
            f"<div class=vcol><div class=vbar style='height:{barpx}px'>"
            f"<span class=in style='height:{inpct:.0f}%'></span><span class=out></span></div>"
            f"<div class=vlabel><b>{escape(r['lang'].upper())}</b></div></div>"
        )
    vchart = f"<div class=vchart>{''.join(vcols)}</div>" if vcols else ""

    side = (
        "<aside class=side><h3>Telemetrie</h3>"
        f"{kpis}"
        "<div class=legend><i style='background:var(--accent)'></i>In "
        "<i style='background:var(--accent2)'></i>Out</div>"
        + ("".join(sbars) or "<p class=muted>Noch keine Calls.</p>")
        + ("<h3>Tokens pro Sprache</h3>" + vchart if vchart else "")
        + "<p style='margin-top:12px'><a class=btn href='/admin/stats'>Details →</a></p></aside>"
    )

    left = (
        f"<h1>Sidelearn — Admin</h1>{lang_tabs(lang)}"
        f"<form method=post action='/admin/discover?lang={lang}&date={today}'>"
        f"<button class='btn primary'>Heute entdecken ({lang.upper()} · {today})</button></form>"
        f"<h3>Tage ({lang.upper()})</h3>{day_links}"
        f"<p class=muted>Provider: {config.PROVIDER} · Modell: {config.GEMINI_MODEL} · "
        f"Level: {', '.join(config.LEVELS)}</p>"
    )
    body = f"<div class=cols><div>{left}</div>{side}</div>"
    return page("Sidelearn Admin", body)


@router.get("/admin/stats", response_class=HTMLResponse)
def admin_stats() -> HTMLResponse:
    t = db.telemetry_totals()
    by = db.telemetry_by_fn()
    recent = db.telemetry_recent(30)
    maxtok = max([r["tin"] + r["tout"] for r in by] + [1])

    bars = []
    for r in by:
        total = r["tin"] + r["tout"]
        w = total / maxtok * 100
        inpct = (r["tin"] / total * 100) if total else 0
        bars.append(
            f"<div class=statrow><div class=statlabel>{escape(r['label'])}</div>"
            f"<div><div class=bar2 style='width:{w:.1f}%'>"
            f"<span class=in style='width:{inpct:.1f}%'></span><span class=out style='flex:1'></span>"
            f"</div></div>"
            f"<div class=statnum>{r['tin']:,} / {r['tout']:,} · ${r['cost']:.4f} · {r['calls']}×</div></div>"
        )

    rows = []
    for r in recent:
        st = "<span class=err>error</span>" if r["status"] == "error" else "ok"
        rows.append(
            f"<tr><td>{escape((r['ts'] or '')[:19])}</td><td>{escape(r['model'] or '')}</td>"
            f"<td>{escape((r['fn'] or '') + ':' + (r['level'] or ''))}</td><td>{escape(r['lang'] or '')}</td>"
            f"<td>{r['input_tokens']:,}</td><td>{r['output_tokens']:,}</td>"
            f"<td>${r['cost_usd'] or 0:.4f}</td><td>{r['ms']} ms</td><td>{st}</td>"
            f"<td>{escape((r['article_url'] or '').replace('https://', ''))[:40]}</td></tr>"
        )

    kpis = (
        "<div class=cards>"
        f"<div class=kpi><b>{t['calls']}</b><span>Calls</span></div>"
        f"<div class=kpi><b>{t['tin']:,}</b><span>Input</span></div>"
        f"<div class=kpi><b>{t['tout']:,}</b><span>Output</span></div>"
        f"<div class=kpi><b>${t['cost']:.4f}</b><span>Kosten</span></div>"
        f"<div class=kpi><b>{t['errors']}</b><span>Fehler</span></div>"
        "</div>"
    )

    # Per-day success / error / cost
    days = db.telemetry_by_day(14)
    day_rows = "".join(
        f"<tr><td>{escape(d['day'] or '')}</td><td>{d['calls']}</td>"
        f"<td style='color:var(--ok)'>{d['ok']}</td>"
        f"<td style='color:var(--err)'>{d['err']}</td><td>${d['cost']:.4f}</td></tr>"
        for d in days
    )
    day_table = (
        "<h3>Pro Tag (Erfolg / Fehler / Kosten)</h3>"
        "<table><tr><th>Tag</th><th>Calls</th><th>OK</th><th>Fehler</th><th>Kosten</th></tr>"
        + (day_rows or "<tr><td colspan=5>—</td></tr>") + "</table>"
    )

    # Area pool: articles per rubric × language
    ap = db.area_pool_overview()
    m: dict[str, dict[str, int]] = {}
    for r in ap:
        m.setdefault(r["area"], {})[r["lang"]] = r["n"]
    head = "<tr><th>Rubrik</th>" + "".join(f"<th>{escape(l)}</th>" for l in config.LANGS) + "<th>Σ</th></tr>"
    ap_rows = ""
    for area in sorted(m):
        cells = "".join(f"<td>{m[area].get(l, 0)}</td>" for l in config.LANGS)
        ap_rows += f"<tr><td>{escape(area)}</td>{cells}<td>{sum(m[area].values())}</td></tr>"
    pool_table = (
        "<h3>Area-Pool (vorgebaute Zufallsartikel pro Rubrik × Sprache)</h3>"
        "<table>" + head + (ap_rows or "<tr><td colspan=99>noch leer</td></tr>") + "</table>"
    )
    body = (
        "<p><a href='/admin'>← Admin</a></p><h1>Telemetrie</h1>"
        f"{kpis}"
        f"{day_table}"
        f"{pool_table}"
        "<h3>Pro Typ (Input/Output-Tokens, Kosten)</h3>"
        "<div class=legend><i style='background:var(--accent)'></i>Input "
        "<i style='background:var(--accent2)'></i>Output</div>"
        + ("".join(bars) or "<p class=muted>Noch keine Calls.</p>")
        + "<h3>Letzte Calls</h3>"
        "<table><tr><th>Zeit</th><th>Modell</th><th>Typ</th><th>Lang</th><th>In</th><th>Out</th>"
        "<th>Kosten</th><th>Dauer</th><th>Status</th><th>Artikel</th></tr>"
        + ("".join(rows) or "<tr><td colspan=10>—</td></tr>")
        + "</table>"
        "<p class=muted>Kosten sind Schätzungen (Preise in config.PRICES).</p>"
    )
    return page("Telemetrie", body)


@router.get("/admin/day", response_class=HTMLResponse)
def admin_day(lang: str = "fr", date: str = "") -> HTMLResponse:
    date_key = date or pipeline.today_key()
    ids = db.daily_article_ids(date_key, lang)
    cards = []
    for aid in ids:
        art = db.get_article(aid)
        if not art:
            continue
        done = set(db.prepared_levels(aid))
        running = aid in pipeline.PROCESSING
        badges = "".join(
            f"<span class='lvl {'done' if lv in done else ''}'>{lv}</span>" for lv in config.LEVELS
        )
        thumb = (
            f"<img src='{escape(art['thumbnail'])}'>"
            if art.get("thumbnail")
            else (
                "<div class=ph><svg width=26 height=26 viewBox='0 0 24 24' fill=none "
                "stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round>"
                "<rect width=18 height=18 x=3 y=3 rx=2/><circle cx=9 cy=9 r=2/>"
                "<path d='m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21'/></svg></div>"
            )
        )
        full = len(done) >= len(config.LEVELS)
        action = (
            "<span class=run>läuft…</span>"
            if running
            else (
                "<span class=muted>fertig</span>"
                if full
                else f"<form method=post action='/admin/process?article_id={aid}&lang={lang}&date={date_key}'>"
                f"<button class=btn>Verarbeiten</button></form>"
            )
        )
        cards.append(
            f"<div class=card>{thumb}<div>"
            f"<div><b>{escape(art['title'])}</b> "
            f"<a href='{escape(art['url'])}' target=_blank>↗</a></div>"
            f"<div class=muted>{len(art['paragraphs'])} Absätze</div>"
            f"<div style='margin:6px 0'>{badges}</div>"
            f"{action} "
            f"<a class=btn href='/admin/article?id={aid}&lang={lang}&date={date_key}'>Ansehen</a>"
            f"</div></div>"
        )
    cards_html = "".join(cards) or "<p class=muted>Kein Pool — oben entdecken.</p>"
    body = (
        f"<h1><a href='/admin?lang={lang}'>← Admin</a> · {date_key}</h1>{lang_tabs(lang, date_key)}"
        f"<div class=bar>"
        f"<form method=post action='/admin/discover?lang={lang}&date={date_key}'><button class=btn>Pool neu entdecken</button></form>"
        f"<form method=post action='/admin/process-day?lang={lang}&date={date_key}'><button class='btn primary'>Alle verarbeiten</button></form>"
        f"</div>{cards_html}"
    )
    busy = any(db.get_article(a) and a in pipeline.PROCESSING for a in ids)
    if busy:
        body += "<p class=muted>Verarbeitung läuft … Seite aktualisiert sich automatisch.</p>"
    return page(f"Admin {date_key} {lang}", body, refresh=5 if busy else 0)


@router.get("/admin/article", response_class=HTMLResponse)
def admin_article(id: str, lang: str = "fr", date: str = "", level: str = "") -> HTMLResponse:
    art = db.get_article(id)
    if not art:
        return page("nicht gefunden", "<p>Artikel nicht gefunden.</p>")
    done = set(db.prepared_levels(id))
    level = level if level in config.LEVELS else (sorted(done)[0] if done else config.LEVELS[0])

    # Level switcher buttons.
    switch = "".join(
        f"<a class='lvlbtn {'on' if lv == level else ''} {'' if lv in done else 'todo'}' "
        f"href='/admin/article?id={id}&lang={lang}&date={date}&level={lv}'>{lv}</a>"
        for lv in config.LEVELS
    )
    running = id in pipeline.PROCESSING
    regen = (
        "<span class=run>läuft…</span>"
        if running
        else f"<form method=post action='/admin/process?article_id={id}&lang={lang}&date={date}&level={level}&force=1'>"
        f"<button class=btn>↻ {level} neu erzeugen</button></form>"
    )
    refresh = 4 if running else 0

    prep = db.get_prepared(id, level)
    if not prep:
        body = (
            f"<p><a href='/admin/day?lang={lang}&date={date}'>← Tagesansicht</a></p>"
            f"<h1>{escape(art['title'])}</h1><div class=bar>{switch} {regen}</div>"
            f"<p class=muted>Level {level} noch nicht verarbeitet — „Verarbeiten“ oder ↻.</p>"
        )
        return page(art["title"], body, refresh=refresh)

    prep_paras = prep.get("paragraphs", [])
    rows = []
    for i, original in enumerate(art["paragraphs"]):
        p = prep_paras[i] if i < len(prep_paras) else {}
        q = p.get("question") or {}
        qbox = (
            f"<div class=qbox><b>Frage:</b> {escape(q.get('q', ''))} "
            f"— {escape(' · '.join(q.get('options', [])))}</div>"
            if q
            else ""
        )
        rows.append(
            f"<div class=para>"
            f"<div><div class=collab>Original</div><div class=orig>{escape(original)}</div></div>"
            f"<div><div class=collab>Vereinfacht · {level}</div>"
            f"<div class=simp>{escape(p.get('simplified', ''))}</div></div>"
            f"{qbox}</div>"
        )
    vocab = ", ".join(escape(v.get("word", "")) for v in prep.get("vocab", []))
    body = (
        f"<p><a href='/admin/day?lang={lang}&date={date}'>← Tagesansicht</a></p>"
        f"<h1>{escape(art['title'])}</h1>"
        f"<p class=muted><a href='{escape(art['url'])}' target=_blank>{escape(art['url'])}</a></p>"
        f"<div class=bar>{switch} {regen}</div>"
        f"<div class=summary><b>Summary ({level}):</b> {escape(prep.get('summary', ''))}</div>"
        + "".join(rows)
        + (f"<p class=muted style='margin-top:14px'>Vokabeln: {vocab}</p>" if vocab else "")
    )
    return page(art["title"], body, refresh=refresh)


@router.post("/admin/discover")
async def admin_discover(lang: str, date: str) -> RedirectResponse:
    await pipeline.discover(lang, _parse(date))
    return RedirectResponse(f"/admin/day?lang={lang}&date={date}", status_code=303)


@router.post("/admin/process")
def admin_process(
    background: BackgroundTasks,
    article_id: str,
    lang: str,
    date: str,
    level: str = "",
    force: bool = False,
) -> RedirectResponse:
    levels = [level] if level in config.LEVELS else None
    background.add_task(pipeline.process_article, article_id, levels, force)
    if level:  # per-level (re)generation came from the article view → go back there
        return RedirectResponse(
            f"/admin/article?id={article_id}&lang={lang}&date={date}&level={level}", status_code=303
        )
    return RedirectResponse(f"/admin/day?lang={lang}&date={date}", status_code=303)


@router.post("/admin/process-day")
def admin_process_day(background: BackgroundTasks, lang: str, date: str) -> RedirectResponse:
    background.add_task(pipeline.process_day, date, lang)
    return RedirectResponse(f"/admin/day?lang={lang}&date={date}", status_code=303)


def _parse(date_key: str) -> date:
    y, m, d = (int(x) for x in date_key.split("-"))
    return date(y, m, d)
