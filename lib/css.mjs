export const CSS = `
:root{--ink:#222;--mut:#777;--line:#e3e0d8;--bg:#faf8f4;--accent:#7a5c3e}
*{box-sizing:border-box}
body{font:16px/1.55 -apple-system,Segoe UI,Roboto,sans-serif;color:var(--ink);
 background:var(--bg);margin:0;overflow-wrap:break-word}
.wrap{max-width:820px;margin:0 auto;padding:24px}
h1{font-family:Georgia,serif;font-weight:700;margin:.2em 0}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
.sub{color:var(--mut);margin:0 0 1.2em}
.back{font-size:.9em}
.updated{font-size:.85em;margin:0 0 .3em}
.card{background:#fff;border:1px solid var(--line);border-radius:10px;
 padding:18px 20px;margin:14px 0}
.evt{margin:.15em 0}.lbl{display:inline-block;min-width:64px;color:var(--mut);
 font-size:.85em;text-transform:uppercase;letter-spacing:.04em}
.yr{color:var(--mut);font-size:.9em}
.unknown{color:var(--mut)}
h2{font-size:.95em;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);
 border-bottom:1px solid var(--line);padding-bottom:4px;margin:1.4em 0 .6em;position:relative}
h2 a.self{position:absolute;left:-1.2em;color:var(--mut);opacity:.35}
h2 a.self:hover,h2 a.self:focus-visible{opacity:1;text-decoration:none}
@media(max-width:880px){h2 a.self{position:static;margin-left:.5em}}
ul.rel{list-style:none;padding:0;margin:0}ul.rel li{margin:.2em 0}
.photos{display:flex;flex-wrap:wrap;gap:12px;margin:.4em 0}
.photos figure{margin:0;width:200px}
.records figure{width:150px}
.photos img{width:100%;border:1px solid var(--line);border-radius:6px;display:block}
.photos a.crop{display:block;position:relative;overflow:hidden;border:1px solid var(--line);border-radius:6px}
.photos a.crop img{position:absolute;max-width:none;border:0;border-radius:0}
.photos .pic{position:relative}
.photos figcaption{font-size:.8em;color:var(--mut);margin-top:4px}
.photos figcaption .cn{display:block;font-style:italic}
.stage{position:relative;margin:.5em 0 1em}
.stage img{display:block;width:100%;height:auto;border:1px solid var(--line);border-radius:8px}
.stage a.who{position:absolute;border:2px solid rgba(255,255,255,.7);border-radius:4px;box-shadow:0 0 0 1px rgba(0,0,0,.35)}
.stage a.who::after{content:'';position:absolute;inset:min(0px,calc((100% - 44px)/2))}
.stage a.who b{position:absolute;left:0;top:0;min-width:1.5em;padding:0 .25em;font-size:12px;line-height:1.5em;
 text-align:center;color:#fff;background:rgba(0,0,0,.55);border-radius:0 0 3px 0}
.stage a.who span{display:none;position:absolute;top:100%;left:-2px;margin-top:4px;padding:2px 8px;z-index:1;
 width:max-content;max-width:min(18em,45vw);font-size:.8em;color:#fff;background:var(--ink);border-radius:4px}
.stage a.who.r span{left:auto;right:-2px}
.stage a.who:hover,.stage a.who:focus-visible,.stage a.who.on{border-color:#fff;box-shadow:0 0 0 2px var(--accent);text-decoration:none}
.stage a.who:hover span,.stage a.who:focus-visible span,.stage a.who.on span{display:block}
.stage:has(+ .outlines input:not(:checked)) a.who:not(.on){display:none}
.outlines{display:block;color:var(--mut);font-size:.85em;margin:-.6em 0 0;cursor:pointer}
ol.placed{margin:0;padding-left:1.6em}ol.placed li{margin:.2em 0;border-radius:4px}ol.placed li.on{background:#f1ece2}
.tab{position:absolute;top:6px;right:6px;display:grid;place-items:center;width:32px;height:32px;
 border-radius:50%;color:#fff;background:rgba(0,0,0,.35)}
.tab:hover{background:rgba(0,0,0,.7);text-decoration:none}
#zoom{padding:0;border:0;border-radius:10px;background:var(--bg);color:var(--ink);
 width:96vw;height:96vh;height:96dvh;max-width:none;max-height:none;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.4)}
#zoom[open]{display:flex;flex-direction:column}
#zoom::backdrop{background:rgba(30,24,18,.85)}
#zoom .frame{flex:1 1 0;min-height:0;container-type:size;display:grid;place-items:center;padding:56px 16px 16px}
#zoom .pic{position:relative}
#zoom img{display:block;max-width:100cqw;max-height:100cqh}
#zoom .tab{top:8px;right:8px;width:40px;height:40px}
#zoom .x{position:absolute;top:8px;right:8px;display:grid;place-items:center;width:40px;height:40px;padding:0;
 border:0;border-radius:50%;color:#fff;background:rgba(0,0,0,.55);cursor:pointer}
#zoom .x:hover{background:rgba(0,0,0,.75)}
#zoom .bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;padding:10px 12px;border-top:1px solid var(--line)}
#zoom .cap{flex:1 1 14em;margin:0;font-size:.9em;color:var(--mut)}
#zoom .cap .cn{display:block;font-style:italic}
#zoom .acts{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
#zoom .acts button,#zoom .acts a{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 12px;
 font:inherit;font-size:.9em;color:var(--accent);background:#fff;border:1px solid var(--line);border-radius:8px;cursor:pointer}
#zoom .acts button:hover,#zoom .acts a:hover{border-color:var(--accent);text-decoration:none}
#zoom .msg{color:var(--accent);font-size:.85em}
#zoom .url{flex-basis:100%;padding:8px;font:inherit;font-size:.85em;border:1px solid var(--line);border-radius:6px}
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
.cite{margin:.15em 0}.cite q{white-space:pre-wrap}.cn{color:var(--mut)}.cite .enote{padding-left:1.8em}.cite .scans{font-size:.85em;white-space:nowrap}
.sources{color:#444;font-size:.92em}
.sec{scroll-margin-top:16px}.sec>details{margin:0}
.sec>details>summary{list-style:none;color:inherit}.sec>details>summary::-webkit-details-marker{display:none}
.sec>details>summary h2::before{content:"\\25be";display:inline-block;width:1.1em}
.sec>details:not([open])>summary h2::before{content:"\\25b8"}
.sec>details>summary:hover h2{color:var(--accent)}
.sec h3{font-size:.8em;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);margin:.9em 0 .3em;font-weight:600}
.sec h3:first-child{margin-top:.2em}
@media(prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}
nav.toc{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:.88em;margin:.2em 0 .8em;padding:8px 0;
 border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
nav.toc a{color:var(--mut)}nav.toc a.on,nav.toc a:hover{color:var(--accent)}
@media(min-width:1260px){nav.toc{position:fixed;top:96px;left:calc(50% - 610px);width:170px;flex-direction:column;
 gap:2px;border:0;border-left:2px solid var(--line);padding:0 0 0 12px;margin:0}
 nav.toc a{padding:3px 0}nav.toc a.on{font-weight:600}}
details.fold{margin:.15em 0}details.fold>summary{list-style:none;color:inherit}
details.fold>summary::-webkit-details-marker{display:none}
details.fold .more{color:var(--mut);font-size:.78em;margin-left:.5em;white-space:nowrap}
details.fold .more::before{content:"\\25b8 ";font-size:.9em}details.fold[open] .more::before{content:"\\25be "}
details.fold>summary:hover .more{color:var(--accent)}
button.all{float:right;margin-top:-2.4em;font:inherit;font-size:.85em;color:var(--accent);background:none;border:0;cursor:pointer;padding:0}
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
