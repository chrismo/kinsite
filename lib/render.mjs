// HTML for the person pages and the index. Output is pinned by test/golden.test.mjs.
import path from 'node:path'
import { place, redact } from './redact.mjs'
import { restricted, mainChildren } from './gedcom.mjs'
import { esc } from './html.mjs'
import { yr, byBirth, birthYear } from './dates.mjs'
import { hourglassLayout, hourglassSvg } from './hourglass.mjs'
import { cropBox } from './media.mjs'

export { esc, yr }
export const DEFAULT_TITLE = 'Family Tree'
export const IMG_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp'])
const CROP_MAX_HEIGHT = 260
const PAIR_SCRIPT = "<script>var W=document.querySelectorAll('.stage a.who'),P=document.querySelectorAll('ol.placed li');" +
  "function on(i,v){W[i].classList.toggle('on',v);P[i].classList.toggle('on',v);}" +
  "[W,P].forEach(function(g){[].forEach.call(g,function(e,i){" +
  "e.addEventListener('mouseenter',function(){on(i,true);});e.addEventListener('mouseleave',function(){on(i,false);});});});" +
  "[].forEach.call(P,function(e,i){e.addEventListener('focusin',function(ev){on(i,ev.target.matches(':focus-visible'));});" +
  "e.addEventListener('focusout',function(){on(i,false);});});" +
  "addEventListener('pageshow',function(){for(var i=0;i<W.length;i++)on(i,false);});</script>"
const icon = d => `<svg viewBox="0 0 24 24" width=18 height=18 fill=none stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round aria-hidden=true><path d="${d}"/></svg>`
const newTab = href => `<a class=tab${href ? ` href="${href}"` : ''} target=_blank rel=noopener aria-label="Open in new tab" title="Open in new tab">` +
  `${icon('M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5')}</a>`
const ZOOM = '<dialog id=zoom aria-label=Photo>' +
  `<button type=button class=x aria-label=Close title=Close>${icon('M6 6l12 12M18 6 6 18')}</button>${newTab()}<img alt="">` +
  '<div class=bar><p class=cap></p><div class=acts>' +
  `<button type=button class=share>${icon('M12 3v12M7 8l5-5 5 5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7')}Share</button>` +
  `<button type=button class=copy>${icon('M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7')}Copy link</button>` +
  '<span class=msg role=status></span></div><input class=url readonly hidden aria-label="Link to this image"></div></dialog>' +
  "<script>var D=document.getElementById('zoom');function Q(s){return D.querySelector(s);}" +
  "var I=Q('img'),C=Q('.cap'),T=Q('a.tab'),U=Q('.url'),M=Q('.msg'),O,H,t;" +
  'function shut(){if(D.open)D.close();}' +
  "function say(s){M.textContent=s;clearTimeout(t);t=setTimeout(function(){M.textContent='';},2000);}" +
  'function show(){U.hidden=false;U.value=H;U.focus();U.select();}' +
  "function copy(){try{navigator.clipboard.writeText(H).then(function(){say('Copied');},show);}catch(e){show();}}" +
  "[].forEach.call(document.querySelectorAll('a.zoom'),function(a){a.addEventListener('click',function(e){" +
  "if(!D.showModal||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();O=a;H=new URL(a.getAttribute('href'),location.href).href;" +
  "var f=a.closest('figure');C.innerHTML=(f?f.querySelector('figcaption'):document.querySelector('h1')).innerHTML;" +
  "I.src=T.href=H;I.alt=a.querySelector('img').alt;U.hidden=true;M.textContent='';D.showModal();});});" +
  "Q('.share').addEventListener('click',function(){if(!navigator.share)return copy();" +
  "navigator.share({url:H}).catch(function(e){if(e.name!=='AbortError')copy();});});" +
  "Q('.copy').addEventListener('click',copy);Q('.x').addEventListener('click',shut);T.addEventListener('click',shut);" +
  "D.addEventListener('click',function(e){if(e.target===D||e.target===I)shut();});" +
  "D.addEventListener('close',function(){O.focus();});addEventListener('pageshow',shut);</script>"
const pct = n => `${+(n * 100).toFixed(3)}%`

export const known = s => ((s ?? '').trim() === '?' ? '' : s ?? '')

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
export const cited = c => [c.title, c.page, c.text, ...c.notes].some(s => s.trim())
const evtBits = e => {
  const bits = [], val = known(e.val), plac = place(known(e.plac))
  if (val && val !== 'Y') bits.push(esc(redact(val)))
  if (when(e)) bits.push(esc(when(e)))
  if (plac) bits.push(esc(plac.replace(/[, ]+$/, '')))
  return bits
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
      return `<div class=cite><span class=cn>[${num()}]</span> ${head}${text}${notesHtml(c.notes)}</div>`
    }).join('')
  }

  evtHtml(title, e, num = counter(), rank = '') {
    const bits = evtBits(e), ev = (this.notes ? notesHtml(e.notes) : '') + this.citesHtml(e.sources, num)
    if (!bits.length && !ev) {
      if (e.tag !== 'BIRT' && e.tag !== 'DEAT') return ''
      bits.push('date unknown')
    }
    return `<div class="evt"><span class="lbl">${title}</span>` +
      (bits.length ? ` ${bits.join(' &middot; ')}` : '') + (rank ? ` <span class=pref>${rank}</span>` : '') +
      (ev ? `<div class=ev>${ev}</div>` : '') + '</div>'
  }

  eventsHtml(p, num = counter()) {
    const label = e => (e.tag !== 'EVEN' ? LABELS[e.tag] : e.type === 'Living' ? 'Residence' : esc(e.type || 'Event'))
    const kept = p.events.filter(e => !restricted(e))
    const says = new Set(kept.filter(e => evtBits(e).length || (this.notes && e.notes?.some(n => n.trim())) || (this.citations && e.sources?.some(cited))))
    // A tag none of whose versions says anything keeps its first, so a bare birth still reads "date unknown".
    const shown = kept.filter(e => says.has(e) || (kept.find(o => o.tag === e.tag) === e && !kept.some(o => o.tag === e.tag && says.has(o))))
      .sort((a, b) => (ORDER[a.tag] ?? 0) - (ORDER[b.tag] ?? 0))
    const same = (e, i) => ONCE.has(e.tag) && shown[i]?.tag === e.tag
    return shown.map((e, i) => same(e, i - 1) ? this.evtHtml('', e, num, 'alternate')
      : this.evtHtml(label(e), e, num, same(e, i + 1) ? 'preferred' : '')).join('')
  }

  marriageHtml(mar) {
    const text = [when(mar), place(known(mar.plac))].filter(Boolean).join(' ').trim()
    return text && !restricted(mar) ? ` <span class=yr>(m. ${esc(text)})</span>` : ''
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
    return `<h2>Parents${label ? `<span class=pref>${esc(label)}</span>` : ''}</h2>` +
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

  attachments(p) {
    const pairs = p.media.filter(md => this.copied.has(md.file)).map(md => [md, this.copied.get(md.file)])
    const isImg = ([md]) => IMG_EXT.has(path.extname(md.file).toLowerCase())
    return { imgs: pairs.filter(isImg), docs: pairs.filter(x => !isImg(x)) }
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

    b.push('<h2>Family</h2>' + this.chartSvg(pid))

    const { imgs, docs } = this.attachments(p)
    if (imgs.length) b.push(`<div class="photos">${imgs.map(([md, src]) => this.figure(md, src, p.name)).join('')}</div>`)

    const num = counter()
    const vit = this.eventsHtml(p, num)
    if (vit) b.push(`<div class=card>${vit}</div>`)

    const rel = []
    const par = this.parentsHtml(p)
    if (par) rel.push(par)
    for (const fid of p.fams) {
      const f = fam.get(fid)
      if (!f) continue
      const spouse = f.husb === pid ? f.wife : f.husb
      const sp = []
      if (spouse) {
        sp.push(`<li>${this.plink(spouse)}${this.marriageHtml(f.marr)}</li>`)
      }
      const kids = [...f.chil].sort(byBirth(this.indi)).map(c => `<li>${this.childHtml(c, fid)}</li>`)
      rel.push('<h2>Spouse &amp; children</h2><ul class=rel>' + sp.join('') + kids.join('') + '</ul>')
    }
    if (rel.length) b.push(rel.join(''))

    const sibs = fam.has(p.famc) ? mainChildren(fam.get(p.famc), this.indi).filter(c => c !== pid).sort(byBirth(this.indi)) : []
    if (sibs.length) b.push('<h2>Siblings</h2><ul class=rel>' + sibs.map(c => `<li>${this.plink(c)}</li>`).join('') + '</ul>')

    const desc = this.descendantsHtml(pid, 3)
    if (desc) b.push('<h2>Descendants</h2>' + desc)

    if (docs.length) {
      const links = docs.map(([md, src]) => `<a href="${esc(src)}">${esc(md.title || path.basename(src))}</a>`).join('')
      b.push(`<h2>Documents</h2><div class=docs>${links}</div>`)
    }

    const notes = this.notes ? p.notes.filter(n => n.trim()) : []
    if (notes.length) b.push('<h2>Notes</h2>' + notes.map(n => `<div class=note>${esc(redact(n))}</div>`).join(''))

    const sources = this.citesHtml(p.sources, num)
    if (sources) b.push(`<h2>Sources</h2><div class=sources>${sources}</div>`)
    if (imgs.some(([md]) => !this.photos.has(md.obje))) b.push(ZOOM)

    return { html: this.page(p.name || pid, b.join('')), withPhoto: imgs.length > 0 }
  }

  indexPage() {
    const lower = s => s.toLowerCase()
    const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
    const people = [...this.indi.values()].sort((a, b) =>
      cmp(lower(a.surn), lower(b.surn)) || cmp(lower(a.giv), lower(b.giv)) || cmp(a.id, b.id))
    const hasPhoto = p => this.attachments(p).imgs.length > 0
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
