// HTML for the person pages and the index. Output is pinned by test/golden.test.mjs.
import path from 'node:path'
import { place, redact } from './redact.mjs'
import { esc } from './html.mjs'
import { yr, byBirth, birthYear, byBirthYear } from './dates.mjs'
import { hourglassLayout, hourglassSvg } from './hourglass.mjs'

export { esc, yr }
export const DEFAULT_TITLE = 'Family Tree'
export const IMG_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp'])

const known = s => ((s ?? '').trim() === '?' ? '' : s ?? '')
const restricted = e => (e.resn ?? '').toUpperCase().split(/[\s,]+/).some(t => t === 'PRIVACY' || t === 'CONFIDENTIAL')

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

export class Renderer {
  constructor({ indi, fam, kin, copied, title = DEFAULT_TITLE, source = '' }) {
    Object.assign(this, { indi, fam, kin, copied, title, source })
  }

  page(title, body) {
    return `<!doctype html><html lang=en><head><meta charset=utf-8>` +
      `<meta name=viewport content='width=device-width,initial-scale=1'>` +
      `<title>${esc(title)}</title><link rel=stylesheet href=style.css></head>` +
      `<body><div class=wrap>${body}` +
      `<footer>Generated ${this.source ? `from <code>${esc(this.source)}</code> ` : ''}by kinsite ` +
      `&middot; ${this.indi.size} individuals &middot; ${this.fam.size} families</footer>` +
      `</div></body></html>`
  }

  plink(pid) {
    const p = this.indi.get(pid)
    if (!p) return '<span class=unknown>(unknown)</span>'
    const l = life(p)
    return `<a href="${pid}.html">${esc(p.name || '(unnamed)')}</a>` + (l ? ` <span class=yr>(${l})</span>` : '')
  }

  evtHtml(title, e) {
    const bits = [], val = known(e.val), plac = place(known(e.plac))
    if (val && val !== 'Y') bits.push(esc(redact(val)))
    if (when(e)) bits.push(esc(when(e)))
    if (plac) bits.push(esc(plac.replace(/[, ]+$/, '')))
    if (!bits.length) {
      if (e.tag !== 'BIRT' && e.tag !== 'DEAT') return ''
      bits.push('date unknown')
    }
    return `<div class="evt"><span class="lbl">${title}</span> ${bits.join(' &middot; ')}</div>`
  }

  eventsHtml(p) {
    const label = e => (e.tag !== 'EVEN' ? LABELS[e.tag] : e.type === 'Living' ? 'Residence' : esc(e.type || 'Event'))
    return p.events.filter(e => !restricted(e)).sort((a, b) => (ORDER[a.tag] ?? 0) - (ORDER[b.tag] ?? 0))
      .map(e => this.evtHtml(label(e), e)).join('')
  }

  marriageHtml(mar) {
    const text = [when(mar), place(known(mar.plac))].filter(Boolean).join(' ').trim()
    return text && !restricted(mar) ? ` <span class=yr>(m. ${esc(text)})</span>` : ''
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

  personPage(pid) {
    const p = this.indi.get(pid), { kin, fam } = this
    const b = ['<p class=back><a href="index.html">&larr; All people</a></p>',
      `<h1>${esc(p.name || '(unnamed)')}</h1>`]
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

    const { imgs, docs } = this.attachments(p)
    if (imgs.length) {
      const cells = imgs.map(([md, src]) =>
        `<figure><a href="${esc(src)}"><img src="${esc(src)}" alt="${esc(md.title)}"></a>` +
        `<figcaption>${esc(md.title)}</figcaption></figure>`).join('')
      b.push(`<div class="photos">${cells}</div>`)
    }

    const vit = this.eventsHtml(p)
    if (vit) b.push(`<div class=card>${vit}</div>`)

    b.push('<h2>Family</h2>' + this.chartSvg(pid))

    const rel = []
    const par = []
    if (p.famc && fam.has(p.famc)) {
      const f = fam.get(p.famc)
      for (const who of [f.husb, f.wife]) if (who) par.push(this.plink(who))
    }
    if (par.length) rel.push('<h2>Parents</h2><ul class=rel>' + par.map(x => `<li>${x}</li>`).join('') + '</ul>')
    for (const fid of p.fams) {
      const f = fam.get(fid)
      if (!f) continue
      const spouse = f.husb === pid ? f.wife : f.husb
      const sp = []
      if (spouse) {
        sp.push(`<li>${this.plink(spouse)}${this.marriageHtml(f.marr)}</li>`)
      }
      const kids = [...f.chil].sort(byBirth(this.indi)).map(c => `<li>${this.plink(c)}</li>`)
      rel.push('<h2>Spouse &amp; children</h2><ul class=rel>' + sp.join('') + kids.join('') + '</ul>')
    }
    if (rel.length) b.push(rel.join(''))

    const sibs = p.famc ? (fam.get(p.famc)?.chil ?? []).filter(c => c !== pid).sort(byBirth(this.indi)) : []
    if (sibs.length) b.push('<h2>Siblings</h2><ul class=rel>' + sibs.map(c => `<li>${this.plink(c)}</li>`).join('') + '</ul>')

    const desc = this.descendantsHtml(pid, 3)
    if (desc) b.push('<h2>Descendants</h2>' + desc)

    if (docs.length) {
      const links = docs.map(([md, src]) => `<a href="${esc(src)}">${esc(md.title || path.basename(src))}</a>`).join('')
      b.push(`<h2>Documents</h2><div class=docs>${links}</div>`)
    }

    const notes = p.notes.filter(n => n.trim())
    if (notes.length) b.push('<h2>Notes</h2>' + notes.map(n => `<div class=note>${esc(redact(n))}</div>`).join(''))

    return { html: this.page(p.name || pid, b.join('')), withPhoto: imgs.length > 0 }
  }

  indexPage() {
    const lower = s => s.toLowerCase()
    const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
    const people = [...this.indi.values()].sort((a, b) =>
      cmp(lower(a.surn), lower(b.surn)) || cmp(lower(a.giv), lower(b.giv)) || cmp(a.id, b.id)).sort(byBirthYear(1))
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
      hero +
      '<h2>All people</h2>' +
      '<input id=q placeholder="Filter by name…" autocomplete=off>' +
      '<button type=button id=sort hidden>Oldest first</button>' +
      `<label class=only><input type=checkbox id=photos> Only people with photos (${withphoto})</label>` +
      `<ul class=people id=list>${items.join('')}</ul>` +
      "<script>var q=document.getElementById('q'),ph=document.getElementById('photos')," +
      "L=document.getElementById('list').children;" +
      "function f(){var v=q.value.toLowerCase();" +
      'for(var i=0;i<L.length;i++){L[i].style.display=' +
      "L[i].getAttribute('data-n').indexOf(v)>-1&&(!ph.checked||L[i].hasAttribute('data-photo'))?'':'none';}}" +
      "q.addEventListener('input',f);ph.addEventListener('change',f);f();" +
      "var sb=document.getElementById('sort'),u=document.getElementById('list'),A=[].slice.call(L),d=1;" +
      "function b(e){var y=e.getAttribute('data-b');return y?+y:null;}" +
      "sb.hidden=false;sb.addEventListener('click',function(){d=-d;sb.textContent=d>0?'Oldest first':'Newest first';" +
      "A.map(function(e,i){return[e,i];}).sort(function(x,y){var p=b(x[0]),q=b(y[0]);" +
      "return p===null||q===null?(p===null)-(q===null)||x[1]-y[1]:d*(p-q)||x[1]-y[1];})" +
      ".forEach(function(x){u.appendChild(x[0]);});});</script>"
    return this.page(this.title, body)
  }
}
