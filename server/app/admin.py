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
:root{color-scheme:light dark}
body{font:15px/1.5 system-ui,sans-serif;margin:0;background:#faf7f5;color:#2c2a30}
@media(prefers-color-scheme:dark){body{background:#1c1b20;color:#ebe8ee}}
.wrap{max-width:880px;margin:0 auto;padding:20px}
a{color:#6b57d6;text-decoration:none}
h1{font-size:20px}
.bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0}
.tab{padding:4px 12px;border:1px solid #ccc4;border-radius:999px;font-weight:600}
.tab.on{background:#6b57d6;color:#fff;border-color:transparent}
.btn{font:inherit;font-weight:600;padding:6px 12px;border:1px solid #ccc4;border-radius:8px;background:#fff2;color:#6b57d6;cursor:pointer}
.btn.primary{background:#6b57d6;color:#fff;border-color:transparent}
.btn:disabled{opacity:.5;cursor:default}
.card{border:1px solid #ccc3;border-radius:12px;padding:14px;margin:10px 0;display:flex;gap:12px}
.card img,.card .ph{width:64px;height:64px;border-radius:8px;flex:0 0 auto}
.card img{object-fit:cover}
.card .ph{background:#8881;display:flex;align-items:center;justify-content:center;color:#8887}
.lvl{display:inline-block;font-size:12px;font-weight:700;padding:1px 8px;border-radius:999px;margin-right:4px;border:1px solid #ccc4}
.lvl.done{background:#2f9e6b22;color:#2f9e6b;border-color:transparent}
.muted{color:#8884;font-size:13px}
.day{display:inline-block;margin:3px 6px 3px 0;padding:3px 10px;border:1px solid #ccc4;border-radius:8px}
form{display:inline}
pre{white-space:pre-wrap;background:#0001;padding:10px;border-radius:8px}
.run{color:#c98a2e;font-weight:700}
.lvlbtn{display:inline-block;padding:4px 14px;margin-right:6px;border-radius:999px;font-weight:700;border:1px solid #ccc4}
.lvlbtn.on{background:#6b57d6;color:#fff;border-color:transparent}
.lvlbtn.todo{opacity:.5}
.summary{background:#6b57d61a;border-radius:12px;padding:14px 16px;margin:14px 0;font-size:16px;line-height:1.5}
.para{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:14px 0;border-top:1px solid #ccc3}
.para .orig{color:#8889;font-size:14px}
.para .simp{font-size:16px;line-height:1.5}
.qbox{grid-column:1/-1;margin-top:4px;font-size:14px;color:#6b57d6cc}
.qbox b{color:inherit}
@media(max-width:760px){.para{grid-template-columns:1fr}.para .orig{order:2}}
.collab{font-size:11px;color:#8886;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}
.cards{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}
.kpi{border:1px solid #ccc3;border-radius:12px;padding:10px 16px;min-width:110px}
.kpi b{display:block;font-size:22px}
.kpi span{color:#8887;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
.statrow{display:grid;grid-template-columns:170px 1fr auto;gap:10px;align-items:center;margin:7px 0;font-size:13px}
.statlabel{font-weight:700}
.bar2{height:16px;border-radius:6px;overflow:hidden;display:flex;background:#8881}
.bar2 .in{background:#6b57d6}.bar2 .out{background:#a07ad0}
.statnum{color:#8888;white-space:nowrap}
.legend{font-size:12px;color:#8888;margin:4px 0}
.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;vertical-align:middle;margin:0 4px}
table{border-collapse:collapse;width:100%;font-size:12px;margin-top:8px}
td,th{text-align:left;padding:5px 8px;border-bottom:1px solid #ccc3;white-space:nowrap}
.err{color:#d2603f}
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
    kpis = (
        "<div class=cards>"
        f"<div class=kpi><b>{t['calls']}</b><span>LLM-Calls</span></div>"
        f"<div class=kpi><b>{t['tin']:,}</b><span>Input-Tokens</span></div>"
        f"<div class=kpi><b>{t['tout']:,}</b><span>Output-Tokens</span></div>"
        f"<div class=kpi><b>${t['cost']:.4f}</b><span>Kosten (geschätzt)</span></div>"
        f"<div class=kpi><b>{t['errors']}</b><span>Fehler</span></div>"
        "</div>"
    )
    body = (
        f"<h1>Sidelearn — Admin</h1>{lang_tabs(lang)}"
        f"<form method=post action='/admin/discover?lang={lang}&date={today}'>"
        f"<button class='btn primary'>Heute entdecken ({lang.upper()} · {today})</button></form>"
        f"<h3>Telemetrie <a class=btn href='/admin/stats'>Details →</a></h3>{kpis}"
        f"<h3>Tage ({lang.upper()})</h3>{day_links}"
        f"<p class=muted>Provider: {config.PROVIDER} · Modell: {config.GEMINI_MODEL} · "
        f"Level: {', '.join(config.LEVELS)}</p>"
    )
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
    body = (
        "<p><a href='/admin'>← Admin</a></p><h1>Telemetrie</h1>"
        f"{kpis}"
        "<h3>Pro Typ (Input/Output-Tokens, Kosten)</h3>"
        "<div class=legend><i style='background:#6b57d6'></i>Input <i style='background:#a07ad0'></i>Output</div>"
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
