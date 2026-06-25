"""Minimal server-rendered admin dashboard to discover + process daily content.

Mutating actions are POST (so crawlers can't trigger them); protect /admin* with
Caddy basicauth in front. No build step — plain HTML + a little inline CSS.
"""

import json
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
.wrap{max-width:900px;margin:0 auto;padding:20px 20px 56px}
a{color:var(--accent);text-decoration:none}
h1{font-size:20px}h3{margin-top:22px}
.bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0}
.tab,.lvlbtn{display:inline-block;border-radius:999px;font-weight:700;border:1px solid var(--border);color:var(--text)}
.tab{padding:4px 14px}.lvlbtn{padding:4px 14px;margin-right:6px}
.tab.on,.lvlbtn.on{background:var(--accent);color:#fff;border-color:transparent}
.lvlbtn.todo{opacity:.45}
.btn{font:inherit;font-weight:600;padding:6px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--accent);cursor:pointer}
.btn.primary{background:var(--accent);color:#fff;border-color:transparent}
.btn.small{padding:3px 9px;font-size:12px}
.dayhead{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:30px 0 8px}
.dayhead .dh{font-size:18px;font-weight:700}
.btn:disabled{opacity:.5;cursor:default}
.card{border:1px solid var(--border);background:var(--surface);border-radius:14px;padding:16px;margin:14px 0;display:flex;gap:14px;line-height:1.5}
.card .lvl{margin-top:2px}
.card img,.card .ph{width:64px;height:64px;border-radius:10px;flex:0 0 auto}
.card img{object-fit:cover}
.card .ph{background:var(--bg);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--muted)}
.lvl{display:inline-block;font-size:12px;font-weight:700;padding:1px 9px;border-radius:999px;margin-right:4px;border:1px solid var(--border);color:var(--muted)}
.lvl.done{background:var(--soft);color:var(--ok);border-color:transparent}
.muted{color:var(--muted);font-size:13px}
.day{display:inline-block;margin:3px 6px 3px 0;padding:4px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface)}
.day.on{background:var(--accent);color:#fff;border-color:transparent}
.daysv{display:flex;flex-direction:column;gap:6px;align-items:flex-start;margin:6px 0 4px}
.daysv .day{margin:0}
.cal-nav{display:flex;align-items:center;gap:12px;margin:6px 0 8px}
.cal-nav b{font-size:14px}
.cal{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;max-width:300px;margin:0 0 8px}
.cal-h{text-align:center;font-size:11px;color:var(--muted);padding:2px 0}
.cal-d{display:flex;align-items:center;justify-content:center;height:34px;border-radius:9px;border:1px solid transparent;color:var(--muted);font-size:13px}
.cal-d.has{color:var(--text);border-color:var(--border);background:var(--surface);font-weight:700}
.cal-d.today{outline:2px solid var(--accent2);outline-offset:-2px}
.cal-d.on{background:var(--accent);color:#fff;border-color:transparent}
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
.cols{display:grid;grid-template-columns:1fr 340px;gap:56px;align-items:stretch}
@media(max-width:820px){.cols{grid-template-columns:1fr}}
.side{position:relative}
.side-inner{position:absolute;inset:0;overflow:hidden;display:flex;flex-direction:column;padding-right:2px}
.costlist{flex:1 1 0;min-height:0;overflow-y:auto;margin:2px 0 6px}
.side-foot{padding-top:14px}
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
/* stats v2: panels, nicer tables, per-day chart, count pills */
.panel{border:1px solid var(--border);background:var(--surface);border-radius:14px;padding:16px 18px;margin:16px 0}
.panel>h3{margin:0 0 10px}
.panel table{margin-top:0}
thead th,table tr:first-child th{font-size:11px;text-transform:uppercase;letter-spacing:.03em;color:var(--muted);border-bottom:2px solid var(--border)}
tbody tr:nth-child(even),table tr:nth-child(even){background:rgba(127,127,127,.06)}
td.num,th.num{text-align:right}
.split{display:flex;gap:26px;flex-wrap:wrap;align-items:center}
.split>*{flex:1 1 0;min-width:260px}
.cap{color:var(--muted);font-size:12.5px;margin:-4px 0 14px}
.tscroll{overflow-x:auto}
.daychart{display:flex;gap:10px;align-items:flex-end;justify-content:space-around;width:100%;height:180px;padding-top:6px}
.daycol{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:34px}
.daybar{width:28px;min-height:3px;display:flex;flex-direction:column-reverse;border-radius:6px 6px 0 0;overflow:hidden;background:var(--border)}
.daybar .okp{background:var(--ok)}.daybar .errp{background:var(--err)}
.daycol .d{font-size:11px;color:var(--muted)}.daycol .cst{font-size:11px;font-weight:700}
.pillrow{display:flex;gap:6px;align-items:center;margin:0 0 10px}
.npill{padding:3px 11px;border:1px solid var(--border);border-radius:999px;font-size:12px;font-weight:700;color:var(--text);cursor:pointer}
#recentGrid{margin-top:8px}
.npill.on{background:var(--accent);color:#fff;border-color:transparent}
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
def admin_home(lang: str = "fr", date: str = "", month: str = "") -> HTMLResponse:
    if lang not in config.LANGS:
        lang = config.LANGS[0]
    today = pipeline.today_key()
    date_key = date or today
    month = month or date_key[:7]
    have = set(db.daily_dates(lang, 366))
    day_links = _month_calendar(lang, date_key, month, have)
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
        "<aside class=side><div class=side-inner><h3>Telemetrie</h3>"
        f"{kpis}"
        "<div class=legend><i style='background:var(--accent)'></i>In "
        "<i style='background:var(--accent2)'></i>Out</div>"
        + "<div class=costlist>" + ("".join(sbars) or "<p class=muted>Noch keine Calls.</p>") + "</div>"
        + ("<h3>Tokens pro Sprache</h3>" + vchart if vchart else "")
        + "<div class=side-foot><p><a class=btn href='/admin/stats'>Details →</a></p>"
        + f"<p class=muted style='margin-top:10px'>Provider: {config.PROVIDER} · {config.GEMINI_MODEL}<br>"
        + f"Level: {', '.join(config.LEVELS)}</p></div></div></aside>"
    )

    cards_html, busy, state = _day_cards(lang, date_key)
    left = (
        "<div>"
        f"<h3 style='margin-top:0'>Tage ({lang.upper()})</h3>{day_links}"
        f"<div class=dayhead><span class=dh>{date_key}</span>{_day_bar(lang, date_key, state, busy)}</div>{cards_html}"
        "</div>"
    )
    body = f"<h1>Sidelearn — Admin</h1>{lang_tabs(lang)}<div class=cols>{left}{side}</div>"
    return page("Sidelearn Admin", body, refresh=5 if busy else 0)


@router.get("/admin/stats", response_class=HTMLResponse)
def admin_stats() -> HTMLResponse:
    t = db.telemetry_totals()
    by = db.telemetry_by_fn()

    # Per-type detail table (right of the cost-per-type chart)
    fn_rows = "".join(
        f"<tr><td>{escape(r['label'])}</td><td class=num>{r['calls']}</td>"
        f"<td class=num>{r['tin']:,}</td><td class=num>{r['tout']:,}</td>"
        f"<td class=num>{round(r['ain']):,}</td><td class=num>{round(r['aout']):,}</td>"
        f"<td class=num>${r['cost']:.4f}</td><td class=num>${r['acost']:.4f}</td></tr>"
        for r in by
    )
    fn_table = (
        "<table><tr><th>Typ</th><th class=num>Calls</th><th class=num>In</th><th class=num>Out</th>"
        "<th class=num>Ø In</th><th class=num>Ø Out</th><th class=num>Kosten</th><th class=num>Ø Kosten</th></tr>"
        + (fn_rows or "<tr><td colspan=8>—</td></tr>") + "</table>"
    )
    fn_json = json.dumps([{"label": r["label"], "cost": round(r["cost"], 4)} for r in by])
    fn_h = max(220, len(by) * 26 + 24)

    # Data for the JS chart (zero-filled year) + Grid.js recent table
    daily_json = json.dumps(db.telemetry_daily_series(365))
    recent_json = json.dumps([
        {
            "ts": (r["ts"] or "")[:19].replace("T", " "), "model": r["model"] or "",
            "typ": (r["fn"] or "") + ((":" + r["level"]) if r["level"] else ""), "lang": r["lang"] or "",
            "in": r["input_tokens"] or 0, "out": r["output_tokens"] or 0,
            "cost": round(r["cost_usd"] or 0, 4), "ms": r["ms"] or 0, "status": r["status"] or "",
            "art": (r["article_url"] or "").replace("https://", "")[:48],
        }
        for r in db.telemetry_recent(200)
    ])

    kpis = (
        "<div class=cards>"
        f"<div class=kpi><b>{t['calls']}</b><span>Calls</span></div>"
        f"<div class=kpi><b>{t['tin']:,}</b><span>Input</span></div>"
        f"<div class=kpi><b>{t['tout']:,}</b><span>Output</span></div>"
        f"<div class=kpi><b>${t['cost']:.4f}</b><span>Kosten</span></div>"
        f"<div class=kpi><b>{t['errors']}</b><span>Fehler</span></div>"
        "</div>"
    )

    day_panel = (
        "<section class=panel><h3>Pro Tag (Erfolg / Fehler / Kosten)</h3>"
        "<p class=cap>LLM-Calls je Kalendertag (UTC). Hohe Tage = Daily-Build + Area-Pool-Nachschub.</p>"
        "<div class=pillrow><span class=muted>Zeitraum:</span>"
        "<a class='npill rng on' data-d=7>1 Woche</a><a class='npill rng' data-d=28>4 Wochen</a>"
        "<a class='npill rng' data-d=90>3 Monate</a><a class='npill rng' data-d=365>1 Jahr</a></div>"
        "<div style='position:relative;height:240px'><canvas id=dayChart></canvas></div>"
        "<div class=cap style='margin:16px 0 4px'>Kosten pro Tag ($)</div>"
        "<div style='position:relative;height:130px'><canvas id=costChart></canvas></div></section>"
    )

    # Area pool: matrix (left) + Σ-per-rubric bar chart (right)
    ap = db.area_pool_overview()
    m: dict[str, dict[str, int]] = {}
    for r in ap:
        m.setdefault(r["area"], {})[r["lang"]] = r["n"]
    head = ("<tr><th>Rubrik</th>" + "".join(f"<th class=num>{escape(l)}</th>" for l in config.LANGS)
            + "<th class=num>Σ</th></tr>")
    ap_rows = ""
    for area in sorted(m):
        cells = "".join(f"<td class=num>{m[area].get(l, 0)}</td>" for l in config.LANGS)
        ap_rows += f"<tr><td>{escape(area)}</td>{cells}<td class=num>{sum(m[area].values())}</td></tr>"
    pool_total = sum(sum(v.values()) for v in m.values())
    area_json = json.dumps(sorted(
        [{"a": a, "n": sum(v.values())} for a, v in m.items()], key=lambda x: -x["n"]
    ))
    area_h = max(200, len(m) * 26 + 24)
    pool_panel = (
        "<section class=panel><h3>Area-Pool · vorgebaute Zufallsartikel</h3>"
        f"<p class=cap>Bibliothek für „🎲 Zufallsartikel“ — <b>kumuliert</b> ({pool_total} Artikel gesamt). "
        f"Der Tages-Build legt automatisch ~{config.AREA_TOPUP_PER_DAY} neue pro Rubrik & Sprache an, "
        "die Zahlen wachsen also mit der Zeit. Σ = Summe je Rubrik über alle Sprachen.</p>"
        "<div class=split><div class=t><table>" + head + (ap_rows or "<tr><td colspan=99>noch leer</td></tr>")
        + "</table></div>"
        f"<div style='position:relative;height:{area_h}px;min-width:240px'><canvas id=areaChart></canvas></div>"
        "</div></section>"
    )

    fn_panel = (
        "<section class=panel><h3>Pro Typ · Kosten & Tokens</h3>"
        "<p class=cap>Kosten je Aufruftyp (links) + Detailzahlen (rechts). Ø = Durchschnitt pro Call.</p>"
        f"<div class=split><div style='position:relative;height:{fn_h}px;min-width:240px'><canvas id=fnChart></canvas></div>"
        f"<div class=t><div class=tscroll>{fn_table}</div></div></div></section>"
    )

    recent_panel = (
        "<section class=panel><h3>Letzte Calls</h3>"
        "<p class=cap>Sortier-, such- und seitenweise. Kosten sind Schätzungen (config.PRICES).</p>"
        "<div id=recentGrid></div></section>"
    )

    scripts = (
        "<link rel=stylesheet href='https://cdn.jsdelivr.net/npm/gridjs/dist/theme/mermaid.min.css'>"
        "<script src='https://cdn.jsdelivr.net/npm/chart.js@4'></script>"
        "<script src='https://cdn.jsdelivr.net/npm/gridjs/dist/gridjs.umd.js'></script>"
        "<script>\n"
        f"const DAILY={daily_json};const RECENT={recent_json};const FN={fn_json};const AREA={area_json};\n"
        "Chart.defaults.color='#8a8590';Chart.defaults.font.family='system-ui';\n"
        "const $=id=>document.getElementById(id);const noL={plugins:{legend:{display:false}}};\n"
        "let chart,costc;\n"
        "function render(days){const d=DAILY.slice(-days);const labels=d.map(x=>x.day.slice(5));\n"
        " if(chart)chart.destroy(); if(costc)costc.destroy();\n"
        " chart=new Chart($('dayChart'),{type:'bar',data:{labels,datasets:[\n"
        "  {label:'OK',data:d.map(x=>x.ok),backgroundColor:'#2f9e6b',stack:'s',borderRadius:3},\n"
        "  {label:'Fehler',data:d.map(x=>x.err),backgroundColor:'#d2603f',stack:'s',borderRadius:3}\n"
        " ]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},\n"
        "  scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,beginAtZero:true,afterFit:s=>{s.width=52}}},\n"
        "  plugins:{legend:{labels:{boxWidth:12}}}}});\n"
        " costc=new Chart($('costChart'),{type:'bar',data:{labels,datasets:[\n"
        "  {data:d.map(x=>x.cost),backgroundColor:'#6b57d6',borderRadius:3}]},\n"
        "  options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},\n"
        "   tooltip:{callbacks:{label:c=>'$'+c.parsed.y.toFixed(4)}}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,afterFit:s=>{s.width=52}}}}});\n"
        "}\n"
        "document.querySelectorAll('.rng').forEach(b=>b.onclick=()=>{document.querySelectorAll('.rng').forEach(x=>x.classList.remove('on'));b.classList.add('on');render(+b.dataset.d);});\n"
        "render(7);\n"
        "new Chart($('fnChart'),{type:'bar',data:{labels:FN.map(x=>x.label),datasets:[{data:FN.map(x=>x.cost),backgroundColor:'#6b57d6',borderRadius:3}]},\n"
        " options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,...noL,scales:{x:{beginAtZero:true},y:{grid:{display:false}}}}});\n"
        "new Chart($('areaChart'),{type:'bar',data:{labels:AREA.map(x=>x.a),datasets:[{data:AREA.map(x=>x.n),backgroundColor:'#2a7e8c',borderRadius:3}]},\n"
        " options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,...noL,scales:{x:{beginAtZero:true},y:{grid:{display:false}}}}});\n"
        "new gridjs.Grid({columns:['Zeit','Modell','Typ','Lang',\n"
        " {name:'In',formatter:c=>c.toLocaleString()},{name:'Out',formatter:c=>c.toLocaleString()},\n"
        " {name:'Kosten',formatter:c=>'$'+Number(c).toFixed(4)},'Dauer','Status','Artikel'],\n"
        " data:RECENT.map(r=>[r.ts,r.model,r.typ,r.lang,r['in'],r.out,r.cost,r.ms+' ms',r.status,r.art]),\n"
        " search:true,sort:true,pagination:{limit:25}}).render($('recentGrid'));\n"
        "</script>"
    )

    body = (
        "<p><a href='/admin'>← Admin</a></p><h1>Telemetrie</h1>"
        f"<section class=panel><h3>Gesamt (seit Start)</h3>"
        "<p class=cap>Kumulierte LLM-Nutzung über die gesamte Laufzeit — nicht nur heute.</p>"
        f"{kpis}</section>"
        f"{day_panel}{pool_panel}{fn_panel}{recent_panel}{scripts}"
    )
    return page("Telemetrie", body)


def _month_calendar(lang: str, date_key: str, month: str, have: set[str]) -> str:
    """Month grid for the day picker. Days with a built pool are highlighted;
    today is outlined; the selected day is filled. Any cell links to that day."""
    import calendar as _calmod
    from datetime import date as _date, timedelta as _td

    y, mo = int(month[:4]), int(month[5:7])
    prev_m = (_date(y, mo, 1) - _td(days=1)).strftime("%Y-%m")
    next_m = (_date(y, mo, 28) + _td(days=10)).replace(day=1).strftime("%Y-%m")
    today = pipeline.today_key()
    head = "".join(f"<span class=cal-h>{d}</span>" for d in ("Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"))
    cells = ["<span></span>"] * _date(y, mo, 1).weekday()
    for d in range(1, _calmod.monthrange(y, mo)[1] + 1):
        ds = f"{y:04d}-{mo:02d}-{d:02d}"
        cls = "cal-d" + (" has" if ds in have else "") + (" on" if ds == date_key else "") + (" today" if ds == today else "")
        cells.append(f"<a class='{cls}' href='/admin?lang={lang}&date={ds}&month={month}'>{d}</a>")
    nav = (
        "<div class=cal-nav>"
        f"<a class=btn href='/admin?lang={lang}&date={date_key}&month={prev_m}'>‹</a>"
        f"<b>{y}-{mo:02d}</b>"
        f"<a class=btn href='/admin?lang={lang}&date={date_key}&month={next_m}'>›</a>"
        "</div>"
    )
    return nav + f"<div class=cal>{head}{''.join(cells)}</div>"


def _day_cards(lang: str, date_key: str) -> tuple[str, bool, str]:
    """Article cards for one day's pool (thumbnail, level badges, per-article
    actions). Returns (html, busy, state) where state is empty|partial|complete.
    Shared by the day page and the admin home."""
    ids = db.daily_article_ids(date_key, lang)
    cards = []
    nlev = len(config.LEVELS)
    n_art = n_done = 0
    for aid in ids:
        art = db.get_article(aid)
        if not art:
            continue
        n_art += 1
        done = set(db.prepared_levels(aid))
        if len(done) >= nlev:
            n_done += 1
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
    cards_html = "".join(cards) or "<p class=muted>Für diesen Tag liegt noch nichts vor.</p>"
    busy = any(db.get_article(a) and a in pipeline.PROCESSING for a in ids)
    state = "empty" if n_art == 0 else ("complete" if n_done >= n_art else "partial")
    return cards_html, busy, state


def _day_bar(lang: str, date_key: str, state: str, busy: bool) -> str:
    """One context action for the day (or none): build an empty day, finish a
    partial one, or — when complete — a small force-reprocess. Auto-build (cron)
    handles the normal case, so nothing shows when there's nothing to do."""

    def form(action: str, label: str, primary: bool = False, extra: str = "", title: str = "") -> str:
        cls = "btn primary" if primary else "btn small"
        ttl = f" title='{escape(title)}'" if title else ""
        return (
            f"<form method=post action='/admin/{action}?lang={lang}&date={date_key}{extra}'>"
            f"<button class='{cls}'{ttl}>{label}</button></form>"
        )

    if busy:
        return "<span class=muted>⏳ läuft … (Auto-Refresh)</span>"
    if state == "empty":
        note = "Noch nichts gebaut." if config.AUTO_BUILD else "Auto-Build ist aus."
        return form("build-day", "Tag bauen", True) + f"<span class=muted>{note}</span>"
    if state == "partial":
        return form("process-day", "Fehlende aufbereiten", True) + "<span class=muted>teilweise</span>"
    return (
        "<span class=muted>✓ vollständig</span>"
        + form("process-day", "↻ neu aufbereiten", False, "&force=1",
               "Erzeugt alle Niveau-Versionen des Tages neu per KI (kostet Tokens).")
    )


@router.get("/admin/day", response_class=HTMLResponse)
def admin_day(lang: str = "fr", date: str = "") -> HTMLResponse:
    date_key = date or pipeline.today_key()
    cards_html, busy, state = _day_cards(lang, date_key)
    body = (
        f"<h1><a href='/admin?lang={lang}'>← Admin</a> · {date_key}</h1>{lang_tabs(lang, date_key)}"
        f"<div class=dayhead>{_day_bar(lang, date_key, state, busy)}</div>{cards_html}"
    )
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
    return RedirectResponse(f"/admin?lang={lang}&date={date}", status_code=303)


@router.post("/admin/build-day")
async def admin_build_day(background: BackgroundTasks, lang: str, date: str) -> RedirectResponse:
    """Build a whole day from scratch: discover the article pool (no LLM), then
    process every level in the background. The one-click action for an empty day."""
    await pipeline.discover(lang, _parse(date))
    background.add_task(pipeline.process_day, date, lang, False)
    return RedirectResponse(f"/admin?lang={lang}&date={date}", status_code=303)


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
def admin_process_day(background: BackgroundTasks, lang: str, date: str, force: bool = False) -> RedirectResponse:
    background.add_task(pipeline.process_day, date, lang, force)
    return RedirectResponse(f"/admin?lang={lang}&date={date}", status_code=303)


@router.get("/admin/abuse", response_class=HTMLResponse)
def admin_abuse(hours: int = 24) -> HTMLResponse:
    """Repeat offenders (rate-limit / origin / blocked hits) for IP-block review."""
    rows = db.abuse_top(hours, 100)
    trs = "".join(
        f"<tr><td><code>{escape(r['ip'] or '?')}</code></td><td>{r['hits']}</td>"
        f"<td>{escape(r['kinds'] or '')}</td><td>{escape((r['last'] or '')[11:19])}</td></tr>"
        for r in rows
    )
    body = (
        f"<h2>Auffällige IPs · letzte {hours}h</h2>"
        "<p>Blocken: IP in <code>SL_BLOCKED_IPS</code> (.env, kommagetrennt) eintragen + Server neu laden.</p>"
        "<table border=1 cellpadding=6 style='border-collapse:collapse'>"
        "<tr><th>IP</th><th>Hits</th><th>Arten</th><th>zuletzt (UTC)</th></tr>"
        f"{trs or '<tr><td colspan=4>nichts</td></tr>'}</table>"
        "<p style='margin-top:12px'><a href='/admin/abuse?hours=168'>letzte 7 Tage</a> · "
        "<a href='/admin/abuse?hours=24'>24h</a></p>"
    )
    return page("Abuse", body)


def _parse(date_key: str) -> date:
    y, m, d = (int(x) for x in date_key.split("-"))
    return date(y, m, d)
