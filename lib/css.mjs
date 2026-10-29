export const CSS = `
:root{--ink:#222;--mut:#777;--line:#e3e0d8;--bg:#faf8f4;--accent:#7a5c3e}
*{box-sizing:border-box}
body{font:16px/1.55 -apple-system,Segoe UI,Roboto,sans-serif;color:var(--ink);
 background:var(--bg);margin:0}
.wrap{max-width:820px;margin:0 auto;padding:24px}
h1{font-family:Georgia,serif;font-weight:700;margin:.2em 0}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
.sub{color:var(--mut);margin:0 0 1.2em}
.back{font-size:.9em}
.card{background:#fff;border:1px solid var(--line);border-radius:10px;
 padding:18px 20px;margin:14px 0}
.evt{margin:.15em 0}.lbl{display:inline-block;min-width:64px;color:var(--mut);
 font-size:.85em;text-transform:uppercase;letter-spacing:.04em}
.yr{color:var(--mut);font-size:.9em}
.unknown{color:var(--mut)}
h2{font-size:.95em;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);
 border-bottom:1px solid var(--line);padding-bottom:4px;margin:1.4em 0 .6em}
ul.rel{list-style:none;padding:0;margin:0}ul.rel li{margin:.2em 0}
.photos{display:flex;flex-wrap:wrap;gap:12px;margin:.4em 0}
.photos figure{margin:0;width:200px}
.photos img{width:100%;border:1px solid var(--line);border-radius:6px;display:block}
.photos figcaption{font-size:.8em;color:var(--mut);margin-top:4px}
.docs a{display:inline-block;margin:.2em .6em .2em 0}
#q{width:100%;padding:10px 12px;font-size:1em;border:1px solid var(--line);
 border-radius:8px;margin:.6em 0 .4em}
#sortby{display:block;color:var(--mut);font-size:.9em;margin:0 0 .5em}#sortby[hidden]{display:none}
.only{display:block;color:var(--mut);font-size:.9em;margin:0 0 1em;cursor:pointer}
.cam{font-size:.85em}
ul.people{list-style:none;padding:0;margin:0;columns:2;column-gap:28px}
@media(max-width:640px){ul.people{columns:1}}
ul.people li{margin:.12em 0;break-inside:avoid}
details{margin:.5em 0}summary{cursor:pointer;color:var(--mut)}
.pref{margin-left:.6em;color:var(--mut);font-size:.72em;text-transform:uppercase;letter-spacing:.04em}
.ev{margin:.1em 0 .5em 68px;color:#444;font-size:.9em}
@media(max-width:640px){.ev{margin-left:14px}}
.enote{white-space:pre-wrap;margin:.1em 0}
.cite{margin:.15em 0}.cn{color:var(--mut)}.cite .enote{padding-left:1.8em}
.sources{color:#444;font-size:.92em}
.note{white-space:pre-wrap;font-size:.92em;color:#444;border-left:3px solid var(--line);
 padding-left:10px;margin:.4em 0}
footer{color:var(--mut);font-size:.85em;margin:2em 0 1em;border-top:1px solid var(--line);
 padding-top:10px}
.pedwrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px;background:#fff;
 padding:12px;margin:.5em 0}
svg.hg{display:block}
svg.hg text{font:12px -apple-system,Segoe UI,sans-serif;fill:var(--ink)}
svg.hg .hg-yr{fill:var(--mut);font-size:11px}
svg.hg path{fill:none;stroke:#d3c4ad;stroke-width:1.5}
svg.hg rect{fill:#fbf7f0;stroke:#d8cdbb}
svg.hg .hg-self{fill:#efe3d2;stroke:var(--accent);stroke-width:1.6}
svg.hg a{cursor:pointer}svg.hg a:hover rect{fill:#f3e9d9}
svg.hg .hg-stub rect,svg.hg .hg-more rect{fill:none;stroke-dasharray:4 3}
svg.hg .hg-stub text,svg.hg .hg-more text{fill:var(--mut);font-style:italic}
.descent{background:#f1ece2;border:1px solid var(--line);border-radius:8px;
 padding:9px 13px;margin:.5em 0;font-size:.95em;line-height:1.7}
.descent .lbl{display:block;color:var(--mut);font-size:.8em;text-transform:uppercase;
 letter-spacing:.04em;margin-bottom:3px}
.descent .hop{color:var(--accent);font-weight:700;padding:0 1px}
ul.tree{list-style:none;margin:.2em 0;padding-left:15px;border-left:1px solid var(--line)}
ul.tree ul.tree{margin-left:2px}
ul.tree li{margin:.16em 0}
`
