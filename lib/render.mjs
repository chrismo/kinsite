// HTML for the person pages and the index. Output is pinned by test/golden.test.mjs.
import path from 'node:path'
import { place, redact } from './redact.mjs'
import { restricted, mainChildren, shownCitations } from './gedcom.mjs'
import { esc } from './html.mjs'
import { yr, byBirth, birthYear } from './dates.mjs'
import { hourglassLayout, hourglassSvg } from './hourglass.mjs'
import { cropBox } from './media.mjs'

export { esc, yr }
export const DEFAULT_TITLE = 'Family Tree'
export const IMG_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp'])
const isImg = md => IMG_EXT.has(path.extname(md.file).toLowerCase())
const isPhoto = md => !!md.crop || (!md.cited && (!md.medi || md.medi === 'PHOTO'))
const CROP_MAX_HEIGHT = 260
const PAIR_SCRIPT = "<script>var W=document.querySelectorAll('.stage a.who'),P=document.querySelectorAll('ol.placed li');" +
  "function on(i,v){W[i].classList.toggle('on',v);P[i].classList.toggle('on',v);}" +
  "[W,P].forEach(function(g){[].forEach.call(g,function(e,i){" +
  "e.addEventListener('mouseenter',function(){on(i,true);});e.addEventListener('mouseleave',function(){on(i,false);});});});" +
  "[].forEach.call(P,function(e,i){e.addEventListener('focusin',function(ev){on(i,ev.target.matches(':focus-visible'));});" +
  "e.addEventListener('focusout',function(){on(i,false);});});" +
  "addEventListener('pageshow',function(){for(var i=0;i<W.length;i++)on(i,false);});</script>"
const icon = d => `<svg viewBox="0 0 24 24" width=18 height=18 fill=none stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round aria-hidden=true><path d="${d}"/></svg>`
const tabIcon = icon('M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5')
const newTab = href => `<a class=tab${href ? ` href="${href}"` : ''} target=_blank rel=noopener aria-label="Open in new tab" title="Open in new tab">${tabIcon}</a>`
const ZOOM = '<dialog id=zoom aria-label=Photo>' +
  `<button type=button class=x aria-label=Close title=Close>${icon('M6 6l12 12M18 6 6 18')}</button>` +
  `<div class=frame><div class=pic><img alt="">${newTab()}</div></div>` +
  '<div class=bar><p class=cap></p><div class=acts>' +
  `<button type=button class=share>${icon('M12 3v12M7 8l5-5 5 5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7')}Share</button>` +
  `<button type=button class=copy>${icon('M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7')}Copy link</button>` +
  `<a class=newtab target=_blank rel=noopener>${tabIcon}Open in new tab</a>` +
  '<span class=msg role=status></span></div><input class=url readonly hidden aria-label="Link to this image"></div></dialog>' +
  "<script>var D=document.getElementById('zoom');function Q(s){return D.querySelector(s);}" +
  "var I=Q('img'),F=Q('.frame'),C=Q('.cap'),T=D.querySelectorAll('a.tab,a.newtab'),U=Q('.url'),M=Q('.msg'),O,H,t;" +
  'function shut(){if(D.open)D.close();}' +
  "function say(s){M.textContent=s;clearTimeout(t);t=setTimeout(function(){M.textContent='';},2000);}" +
  'function show(){U.hidden=false;U.value=H;U.focus();U.select();}' +
  "function copy(){try{navigator.clipboard.writeText(H).then(function(){say('Copied');},show);}catch(e){show();}}" +
  "[].forEach.call(document.querySelectorAll('a.zoom'),function(a){a.addEventListener('click',function(e){" +
  "if(!D.showModal||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();O=a;H=new URL(a.getAttribute('href'),location.href).href;" +
  "var f=a.closest('figure'),m=a.querySelector('img');if(f)C.innerHTML=f.querySelector('figcaption').innerHTML;" +
  "else if(a.title)C.textContent=a.title;else C.innerHTML=document.querySelector('h1').innerHTML;" +
  "I.src=H;[].forEach.call(T,function(x){x.href=H;});I.alt=m?m.alt:a.title;U.hidden=true;M.textContent='';D.showModal();});});" +
  "Q('.share').addEventListener('click',function(){if(!navigator.share)return copy();" +
  "navigator.share({url:H}).catch(function(e){if(e.name!=='AbortError')copy();});});" +
  "Q('.copy').addEventListener('click',copy);Q('.x').addEventListener('click',shut);[].forEach.call(T,function(x){x.addEventListener('click',shut);});" +
  "D.addEventListener('click',function(e){if(e.target===D||e.target===F||e.target===I)shut();});" +
  "D.addEventListener('close',function(){O.focus();});addEventListener('pageshow',shut);</script>"
const TOC_SCRIPT = "<script>(function(){var L=document.querySelectorAll('nav.toc a'),S=[].map.call(L,function(a){return document.getElementById(a.getAttribute('href').slice(1));});" +
  "function open(id){var s=document.getElementById(id),d=s&&s.querySelector('details');if(d)d.open=true;}" +
  "function spy(){var y=innerHeight*.3,k=0;S.forEach(function(s,i){if(s.getBoundingClientRect().top<y)k=i;});[].forEach.call(L,function(a,i){a.classList.toggle('on',i===k);});}" +
  "addEventListener('scroll',spy,{passive:true});spy();" +
  "[].forEach.call(L,function(a){a.addEventListener('click',function(){open(a.getAttribute('href').slice(1));});});" +
  "function reveal(){if(location.hash)open(decodeURIComponent(location.hash.slice(1)));}addEventListener('hashchange',reveal);reveal();" +
  "var B=document.querySelector('button.all');if(B){B.hidden=false;B.addEventListener('click',function(){var on=B.getAttribute('aria-pressed')!=='true';" +
  "B.setAttribute('aria-pressed',on);B.textContent=on?'Hide all sources':'Show all sources';" +
  "[].forEach.call(document.querySelectorAll('details.fold'),function(d){d.open=on;});});}})();</script>"
const pct = n => `${+(n * 100).toFixed(3)}%`
const count = (n, one) => (n ? `${n} ${n === 1 ? one : `${one}s`}` : '')

export const known = s => ((s ?? '').trim() === '?' ? '' : s ?? '')
const marriageText = m => [when(m), place(known(m.plac))].filter(Boolean).join(' ').trim()

export function life(p) {
  const b = restricted(p.birt) ? '' : yr(p.birt.date), d = restricted(p.deat) ? '' : yr(p.deat.date)
  return b || d ? `${b}–${d}` : ''
}

const QUALIFIERS = { ABT: 'about', BEF: 'before', AFT: 'after', CAL: 'calculated', EST: 'estimated', FROM: 'from', TO: 'to' }

function readable(date) {
  const range = date.match(/^(?:BET (.+) AND|FROM (.+) TO) (.+)$/)
  if (range) return `${range[1] ?? range[2]} – ${range[3]}`
  const [, q, rest] = date.match(/^(\w+) (.+)$/) ?? []
  return QUALIFIERS[q] ? `${QUALIFIERS[q]} ${rest}` : date
}

const yearPair = s => /^\d{4}\/\d{1,4}$/.test(s ?? '')

export function when(e) {
  const date = e.date ? readable(e.date) : ''
  if (!e.phrase || (date && yearPair(e.phrase))) return date
  return date ? `${date} (${e.phrase})` : e.phrase
}

const LABELS = {
  BIRT: 'Born', CHR: 'Christened', BAPM: 'Baptized', DEAT: 'Died', BURI: 'Buried',
  RESI: 'Residence', EMIG: 'Emigrated', OCCU: 'Occupation',
}
const ORDER = { BIRT: -3, CHR: -2, BAPM: -1, DEAT: 1, BURI: 2 }
// Repeats of these are alternate versions; GEDCOM 7 puts the preferred one first.
export const ONCE = new Set(Object.keys(ORDER))
const counter = (n = 0) => () => ++n
const eventYear = e => Number(yr(e.date)) || Infinity
export const cited = c => [c.title, c.page, c.text, ...c.notes].some(s => s.trim()) || !!c.media?.length
const evtBits = e => {
  const bits = [], val = known(e.val), plac = place(known(e.plac))
  if (val && val !== 'Y') bits.push(esc(redact(val)))
  if (when(e)) bits.push(esc(when(e)))
  if (plac) bits.push(esc(plac.replace(/[, ]+$/, '')))
  return bits
}
export const says = (e, { notes = true, citations = true } = {}) =>
  evtBits(e).length > 0 || (notes && !!e.notes?.some(n => n.trim())) || (citations && !!e.sources?.some(cited))
// A bare birth or death still shows, as "date unknown".
export const showable = (versions, opts) => {
  const saying = versions.filter(e => says(e, opts))
  return saying.length ? saying : versions.slice(0, 1).filter(e => e.tag === 'BIRT' || e.tag === 'DEAT')
}
// How a child belongs to a parent family; a main family born into needs no label.
export const linkLabel = (l, main = false) => [
  l.pedi === 'OTHER' ? l.phrase || 'other' : main && l.pedi === 'BIRTH' ? '' : l.pedi.toLowerCase(),
  l.stat.toLowerCase(),
  l.only && `on the ${l.only === 'child' ? "child's" : 'family'} record only`,
].filter(Boolean).join(', ')
const notesHtml = notes => (notes ?? []).filter(n => n.trim()).map(n => `<div class=enote>${esc(redact(n))}</div>`).join('')

export class Renderer {
  constructor({ indi, fam, kin, copied, sizes = new Map(), title = DEFAULT_TITLE, source = '', citations = true, notes = true, news = false, updated = new Map() }) {
    Object.assign(this, { indi, fam, kin, copied, sizes, title, source, citations, notes, news, updated })
  }

  page(title, body) {
    return `<!doctype html><html lang=en><head><meta charset=utf-8>` +
      `<meta name=viewport content='width=device-width,initial-scale=1'>` +
      `<title>${esc(title)}</title><link rel=stylesheet href=style.css></head>` +
      `<body><div class=wrap>${body}` +
      `<footer>Generated ${this.source ? `from <code>${esc(this.source)}</code> ` : ''}by <a href="https://github.com/chrismo/kinsite">kinsite</a> ` +
      `&middot; ${this.indi.size} individuals &middot; ${this.fam.size} families</footer>` +
      `</div></body></html>`
  }

  plink(pid) {
    const p = this.indi.get(pid)
    if (!p) return '<span class=unknown>(unknown)</span>'
    const l = life(p)
    return `<a href="${pid}.html">${esc(p.name || '(unnamed)')}</a>` + (l ? ` <span class=yr>(${l})</span>` : '')
  }

  citesHtml(sources, num) {
    if (!this.citations) return ''
    return (sources ?? []).filter(cited).map(c => {
      const head = [c.title, c.page].filter(s => s.trim()).map(s => esc(redact(s.trim()))).join(', ')
      const text = c.text.trim() ? `${head ? ' — ' : ''}<q>${esc(redact(c.text.trim()))}</q>` : ''
      const scans = this.scansHtml(c)
      return `<div class=cite><span class=cn>[${num()}]</span> ${head}${text}${scans && (head || text ? ' ' : '') + scans}${notesHtml(c.notes)}</div>`
    }).join('')
  }

  citeFiles(c) {
    return (c.media ?? []).filter(md => this.copied?.has(md.file))
  }

  scansHtml(c) {
    const files = this.citeFiles(c)
    const href = md => esc(this.copied.get(md.file))
    const pic = (md, text) => `<a class="scan zoom" href="${href(md)}" title="${esc(md.title || redact(c.title.trim()))}">${text}</a>`
    const pics = files.filter(isImg)
    const links = [
      ...(pics.length > 1 ? [`scans ${pics.map((md, i) => pic(md, i + 1)).join(' · ')}`] : pics.map(md => pic(md, 'scan'))),
      ...files.filter(md => !isImg(md)).map(md => `<a class=scan href="${href(md)}">${esc(path.extname(md.file).slice(1).toUpperCase() || 'file')}</a>`),
    ]
    return links.length ? `<span class=scans>${links.join(' · ')}</span>` : ''
  }

  evtHtml(title, e, num = counter(), rank = '') {
    const bits = evtBits(e), ev = (this.notes ? notesHtml(e.notes) : '') + this.citesHtml(e.sources, num)
    if (!bits.length && !ev) {
      if (e.tag !== 'BIRT' && e.tag !== 'DEAT') return ''
      bits.push('date unknown')
    }
    const line = `<span class="lbl">${title}</span>` +
      (bits.length ? ` ${bits.join(' &middot; ')}` : '') + (rank ? ` <span class=pref>${rank}</span>` : '')
    if (!ev) return `<div class="evt">${line}</div>`
    const cites = this.citations ? (e.sources ?? []).filter(cited) : []
    const more = [
      count(cites.length, 'source'),
      count(cites.flatMap(c => this.citeFiles(c)).filter(isImg).length, 'scan'),
      ((this.notes && e.notes?.some(n => n.trim())) || cites.some(c => c.notes.some(n => n.trim()))) && 'notes',
    ].filter(Boolean).join(' · ')
    return `<details class="evt fold"><summary>${line} <span class=more>${more}</span></summary><div class=ev>${ev}</div></details>`
  }

  eventsHtml(p, num = counter()) {
    const label = e => (e.tag !== 'EVEN' ? LABELS[e.tag] : e.type === 'Living' ? 'Residence' : esc(e.type || 'Event'))
    const kept = p.events.filter(e => !restricted(e))
    const shown = kept.filter(e => showable(kept.filter(o => o.tag === e.tag), this).includes(e)).sort((a, b) => (ORDER[a.tag] ?? 0) - (ORDER[b.tag] ?? 0) || (ORDER[a.tag] ? 0 : eventYear(a) - eventYear(b) || 0))
    const same = (e, i) => ONCE.has(e.tag) && shown[i]?.tag === e.tag
    return shown.map((e, i) => same(e, i - 1) ? this.evtHtml('', e, num, 'alternate')
      : this.evtHtml(label(e), e, num, same(e, i + 1) ? 'preferred' : '')).join('')
  }

  marriageHtml(marrs) {
    const [first, ...rest] = marrs.filter(m => !restricted(m) && says(m))
    if (!first) return ''
    const rank = r => `<span class=pref>${r}</span>`
    return ` <span class=yr>(m. ${esc(marriageText(first))})</span>${rest.length ? rank('preferred') : ''}` +
      rest.map(m => `<div class=yr>m. ${esc(marriageText(m))}${rank('alternate')}</div>`).join('')
  }

  parentIds(fid) {
    const f = this.fam.get(fid)
    return [f.husb, f.wife].filter(Boolean)
  }

  nameLink(pid) {
    const p = this.indi.get(pid)
    return p ? `<a href="${pid}.html">${esc(p.name || '(unnamed)')}</a>` : this.plink(pid)
  }

  parentsHtml(p) {
    const { fam } = this
    const links = (p.parentFams ?? []).filter(l => fam.has(l.fam))
    const main = links.find(l => l.fam === p.famc)
    const items = main ? this.parentIds(main.fam).map(id => this.plink(id)) : []
    for (const l of links) {
      if (l === main) continue
      const label = linkLabel(l)
      const names = this.parentIds(l.fam).map(id => this.plink(id)).join(' and ') || 'unrecorded parents'
      items.push(`Also listed as a child of ${names}` + (label ? ` <span class=pref>${esc(label)}</span>` : ''))
    }
    if (!items.length) return ''
    const label = main && linkLabel(main, true)
    return `<h3>Parents${label ? `<span class=pref>${esc(label)}</span>` : ''}</h3>` +
      '<ul class=rel>' + items.map(x => `<li>${x}</li>`).join('') + '</ul>'
  }

  // A child whose main parent family is another one, or whose link is one-sided, says so.
  childHtml(c, fid) {
    const k = this.indi.get(c)
    const link = k?.parentFams?.find(l => l.fam === fid)
    if (!k || (k.famc === fid && !link?.only)) return this.plink(c)
    const main = k.famc !== fid && this.fam.has(k.famc) && this.parentIds(k.famc).map(id => this.nameLink(id)).join(' and ')
    const note = [link && esc(linkLabel(link)), main && `main parents: ${main}`].filter(Boolean).join('; ')
    return this.plink(c) + (note ? ` <span class=yr>(${note})</span>` : '')
  }

  chartSvg(pid) {
    const label = id => {
      const p = this.indi.get(id)
      return [p.name || '(unnamed)', life(p)]
    }
    return hourglassSvg(hourglassLayout(pid, this), label)
  }

  descendantsHtml(pid, depth) {
    const kids = depth > 0 ? this.kin.childrenOf(pid).sort(byBirth(this.indi)) : []
    if (!kids.length) return ''
    return '<ul class=tree>' +
      kids.map(c => `<li>${this.plink(c)}${this.descendantsHtml(c, depth - 1)}</li>`).join('') + '</ul>'
  }

  // imgs: the person's own images, which decide photo pages.
  attachments(p) {
    const have = md => this.copied?.has(md.file), pair = md => [md, this.copied.get(md.file)]
    const direct = [...p.media, ...(p.fams ?? []).flatMap(f => this.fam?.get(f)?.media ?? [])].filter(have)
    const scans = this.citations ? shownCitations(p).flatMap(c => c.media ?? []).filter(have) : []
    // A crop is its own picture; any other repeat of a file shows once.
    const seen = new Set(), once = ([md, src]) => {
      const key = md.crop ? `${src} ${JSON.stringify(md.crop)}` : src
      return !seen.has(key) && !!seen.add(key)
    }
    const photos = direct.filter(md => isImg(md) && isPhoto(md)).map(pair).filter(once)
    const records = [...direct.filter(md => isImg(md) && !isPhoto(md)), ...scans.filter(isImg).map(md => ({ ...md, scan: true }))].map(pair).filter(once)
    return { imgs: p.media.filter(md => have(md) && isImg(md)).map(pair), photos, records, docs: direct.filter(md => !isImg(md)).map(pair) }
  }

  get photos() {
    if (!this._photos) {
      const links = new Map()
      for (const [pid, p] of this.indi) {
        for (const [md] of this.attachments(p).imgs) if (md.obje) links.set(md.obje, [...(links.get(md.obje) ?? []), { pid, md }])
      }
      this._photos = new Map([...links].filter(([, l]) => l.length > 1 || l.some(({ md }) => md.crop)))
    }
    return this._photos
  }

  figure(md, src, name) {
    const { title, caption } = md
    const size = this.sizes.get(md.file)
    const box = md.crop && cropBox(md.crop, size)
    const alt = esc(box && name ? [name, title].filter(Boolean).join(' in ') : title || caption)
    const text = title && caption && caption !== title ? `${esc(title)}<span class=cn>${esc(caption)}</span>` : esc(title || caption)
    const toPage = this.photos.has(md.obje), href = esc(toPage ? `${md.obje}.html` : src)
    const width = box ? ` style="width:min(100%,${Math.round(CROP_MAX_HEIGHT * box.width / box.height)}px)"` : ''
    const img = box
      ? `<a class=${toPage ? 'crop' : '"crop zoom"'} href="${href}" style="aspect-ratio:${box.width}/${box.height}">` +
        `<img src="${esc(src)}" alt="${alt}" style="width:${pct(size.width / box.width)};left:${pct(-box.left / box.width)};top:${pct(-box.top / box.height)}"></a>`
      : `<a${toPage ? '' : ' class=zoom'} href="${href}"><img src="${esc(src)}" alt="${alt}"></a>`
    return `<figure><div class=pic${width}>${img}${newTab(esc(src))}</div><figcaption>${text}</figcaption></figure>`
  }

  photoPage(oid) {
    const links = this.photos.get(oid), { file, title } = links[0].md
    const src = esc(this.copied.get(file)), size = this.sizes.get(file), heading = title || 'Photo'
    const boxed = links.map(l => ({ ...l, box: l.md.crop && cropBox(l.md.crop, size) }))
    const placed = boxed.filter(l => l.box).sort((a, b) => a.box.left - b.box.left || a.box.top - b.box.top)
    const unplaced = boxed.filter(l => !l.box)
    const item = ({ pid, md }) => `<li>${this.plink(pid)}${md.caption ? ` <span class=cn>${esc(md.caption)}</span>` : ''}</li>`
    const boxes = placed.map(({ pid, md, box }, i) => {
      const label = [this.indi.get(pid).name || '(unnamed)', md.caption].filter(Boolean).join(' · ')
      const right = box.left + box.width / 2 > size.width / 2 ? ' r' : ''
      return `<a class="who${right}" href="${pid}.html" style="left:${pct(box.left / size.width)};top:${pct(box.top / size.height)};` +
        `width:${pct(box.width / size.width)};height:${pct(box.height / size.height)}"><b>${i + 1}</b><span>${esc(label)}</span></a>`
    })
    const b = ['<p class=back><a href="index.html">&larr; All people</a></p>', `<h1>${esc(heading)}</h1>`,
      `<div class=stage><a class=zoom href="${src}"><img src="${src}" alt="${esc(heading)}"></a>${boxes.join('')}</div>`]
    if (placed.length) b.push('<label class=outlines><input type=checkbox checked> Show outlines</label>', `<h2>In this photo</h2><ol class=placed>${placed.map(item).join('')}</ol>`, PAIR_SCRIPT)
    if (unplaced.length) b.push(`<h2>Also in this photo (not yet placed)</h2><ul class=rel>${unplaced.map(item).join('')}</ul>`)
    b.push(ZOOM)
    return this.page(heading, b.join(''))
  }

  personPage(pid) {
    const p = this.indi.get(pid), { kin, fam } = this
    const b = ['<p class=back><a href="index.html">&larr; All people</a></p>',
      `<h1>${esc(p.name || '(unnamed)')}</h1>`]
    if (p.private) {
      b.push('<p class=sub>Details of living people are withheld.</p>')
      return { html: this.page(p.name, b.join('')), withPhoto: false }
    }
    const up = this.updated.get(pid)
    if (up) {
      const links = [
        up.date && `<a href="whats-new.html#${up.anchor}">Updated ${esc(up.date)}</a>`,
        up.pending && '<a href="whats-new.html#pending">Changed since last deploy</a>',
      ]
      b.push(`<p class=updated>${links.filter(Boolean).join(' · ')}</p>`)
    }
    const meta = [{ M: 'Male', F: 'Female' }[p.sex] ?? '', life(p)].filter(Boolean).join(' &middot; ')
    if (meta) b.push(`<p class=sub>${meta}</p>`)

    if (pid !== kin.primary) {
      const rp = kin.relPath(pid)
      if (rp && rp.length > 1) {
        let crumb = this.plink(rp[0])
        for (let i = 0; i + 1 < rp.length; i++) {
          crumb += ` <span class=hop>${kin.hop(rp[i], rp[i + 1])}</span> ` + this.plink(rp[i + 1])
        }
        b.push(`<div class=descent><span class=lbl>Path to ` +
          `${esc(this.indi.get(kin.primary).name)} (${rp.length - 1} steps)</span>${crumb}</div>`)
      }
    }

    const secs = []
    const sec = (id, label, html) => html && secs.push({ id, label, html })
    sec('tree', 'Family tree', this.chartSvg(pid))

    const { photos, records, docs } = this.attachments(p)
    const figures = list => list.map(([md, src]) => this.figure(md, src, p.name)).join('')
    if (photos.length) sec('photos', 'Photos', `<div class="photos">${figures(photos)}</div>`)

    const rel = []
    const par = this.parentsHtml(p)
    if (par) rel.push(par)
    for (const fid of p.fams) {
      const f = fam.get(fid)
      if (!f) continue
      const spouse = f.husb === pid ? f.wife : f.husb
      const sp = []
      if (spouse) {
        sp.push(`<li>${this.plink(spouse)}${this.marriageHtml(f.marrs)}</li>`)
      }
      const kids = [...f.chil].sort(byBirth(this.indi)).map(c => `<li>${this.childHtml(c, fid)}</li>`)
      rel.push('<h3>Spouse &amp; children</h3><ul class=rel>' + sp.join('') + kids.join('') + '</ul>')
    }
    const sibs = fam.has(p.famc) ? mainChildren(fam.get(p.famc), this.indi).filter(c => c !== pid).sort(byBirth(this.indi)) : []
    if (sibs.length) rel.push('<h3>Siblings</h3><ul class=rel>' + sibs.map(c => `<li>${this.plink(c)}</li>`).join('') + '</ul>')
    sec('kin', 'Close family', rel.join(''))

    const num = counter()
    const vit = this.eventsHtml(p, num)
    const all = vit.includes('<details') ? '<button type=button class=all aria-pressed=false hidden>Show all sources</button>' : ''
    if (vit) sec('events', 'Life events', `${all}<div class=card>${vit}</div>`)
    if (records.length) sec('records', 'Records', `<div class="photos records">${figures(records)}</div>`)

    const notes = this.notes ? p.notes.filter(n => n.trim()) : []
    if (notes.length) sec('notes', 'Notes', notes.map(n => `<div class=note>${esc(redact(n))}</div>`).join(''))

    sec('descendants', 'Descendants', this.descendantsHtml(pid, 3))

    if (docs.length) {
      const links = docs.map(([md, src]) => `<a href="${esc(src)}">${esc(md.title || path.basename(src))}</a>`).join('')
      sec('documents', 'Documents', `<div class=docs>${links}</div>`)
    }

    const sources = this.citesHtml(p.sources, num)
    if (sources) sec('sources', 'Sources', `<div class=sources>${sources}</div>`)

    if (secs.length > 2) b.push(`<nav class=toc aria-label="On this page">${secs.map(s => `<a href="#${s.id}">${s.label}</a>`).join('')}</nav>`)
    for (const s of secs) b.push(`<section id=${s.id} class=sec><details open><summary><h2>${s.label}</h2></summary>${s.html}</details></section>`)
    if (secs.length > 2 || all) b.push(TOC_SCRIPT)
    const scanned = this.citations && shownCitations(p).some(c => this.citeFiles(c).some(isImg))
    if (scanned || [...photos, ...records].some(([md]) => !this.photos.has(md.obje))) b.push(ZOOM)

    return { html: this.page(p.name || pid, b.join('')), withPhoto: photos.length > 0 }
  }

  indexPage() {
    const lower = s => s.toLowerCase()
    const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
    const people = [...this.indi.values()].sort((a, b) =>
      cmp(lower(a.surn), lower(b.surn)) || cmp(lower(a.giv), lower(b.giv)) || cmp(a.id, b.id))
    const hasPhoto = p => this.attachments(p).photos.length > 0
    const withphoto = people.filter(hasPhoto).length
    const items = people.map(p => {
      const disp = p.surn ? `${esc(p.surn)}, ${esc(p.giv)}` : esc(p.name || '(unnamed)')
      const l = life(p)
      const photo = hasPhoto(p)
      const b = birthYear(p)
      return `<li data-n="${esc(p.name.toLowerCase())}"${b ? ` data-b=${b}` : ''}${photo ? ' data-photo' : ''}>` +
        `<a href="${p.id}.html">${disp}</a>` + (l ? ` <span class=yr>${l}</span>` : '') +
        (photo ? ' <span class=cam title="Has photos">📷</span>' : '') + '</li>'
    })
    const root = this.kin.primary ?? people[0]?.id ?? null
    const hero = root ? `<h2>Family of ${esc(this.indi.get(root).name)}</h2>${this.chartSvg(root)}` : ''
    const body = `<h1>${esc(this.title)}</h1>` +
      `<p class=sub>${this.indi.size} individuals &middot; ${this.fam.size} families ` +
      `&middot; ${withphoto} with photos</p>` +
      (this.news ? `<p><a href="whats-new.html">${esc("What's new")}</a></p>` : '') +
      hero +
      '<h2>All people</h2>' +
      '<input id=q placeholder="Filter by name…" autocomplete=off>' +
      '<label id=sortby hidden>Sort by <select id=sort><option value=name selected>Name (A–Z)</option>' +
      '<option value=old>Birth year, oldest first</option><option value=new>Birth year, newest first</option></select></label>' +
      `<label class=only><input type=checkbox id=photos> Only people with photos (${withphoto})</label>` +
      `<ul class=people id=list>${items.join('')}</ul>` +
      "<script>var q=document.getElementById('q'),ph=document.getElementById('photos')," +
      "L=document.getElementById('list').children;" +
      "function f(){var v=q.value.toLowerCase();" +
      'for(var i=0;i<L.length;i++){L[i].style.display=' +
      "L[i].getAttribute('data-n').indexOf(v)>-1&&(!ph.checked||L[i].hasAttribute('data-photo'))?'':'none';}}" +
      "q.addEventListener('input',f);ph.addEventListener('change',f);f();" +
      "var sb=document.getElementById('sort'),u=document.getElementById('list'),A=[].slice.call(L);" +
      "function b(e){var y=e.getAttribute('data-b');return y?+y:null;}" +
      "document.getElementById('sortby').hidden=false;" +
      "sb.addEventListener('change',function(){var d={name:0,old:1,new:-1}[sb.value];" +
      "A.map(function(e,i){return[e,i];}).sort(function(x,y){var p=b(x[0]),r=b(y[0]);" +
      "return (!d?0:p===null||r===null?(p===null)-(r===null):d*(p-r))||x[1]-y[1];})" +
      ".forEach(function(x){u.appendChild(x[0]);});});</script>"
    return this.page(this.title, body)
  }
}
