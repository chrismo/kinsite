// Minimal GEDCOM 7.0 reader: only what the site renders.
import { yr } from './dates.mjs'

const CROP = new Set(['TOP', 'LEFT', 'HEIGHT', 'WIDTH'])
const EVENTS = new Set(['BIRT', 'CHR', 'BAPM', 'DEAT', 'BURI', 'RESI', 'EMIG', 'OCCU', 'EVEN'])

export const restricted = e => (e.resn ?? '').toUpperCase().split(/[\s,]+/).some(t => t === 'PRIVACY' || t === 'CONFIDENTIAL')

export function parseGedcom(text) {
  const indi = new Map(), fam = new Map(), obje = new Map(), sour = new Map(), pointers = []
  let cur = null, ctype = null, evt = null, famc = null, media = null, link = null, sub = null, cite = null, citeLvl = 0, cont = null, shownName = false
  const startCitation = (val, lvl, list) => {
    const ptr = val.match(/^@(\w+)@$/)
    cite = { sour: ptr?.[1] ?? '', title: '', page: '', text: '', notes: [] }
    citeLvl = lvl
    list.push(cite)
    if (ptr) pointers.push(cite)
    else {
      cite.title = val.trim()
      cont = { lvl, obj: cite, key: 'title' }
    }
  }

  for (const ln of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (!ln.trim()) continue
    const m = ln.match(/^(\d+) ([^\n]*)$/)
    if (!m) continue
    const lvl = Number(m[1]), rest = m[2]
    if (lvl === 0) {
      cur = ctype = evt = famc = media = link = cite = cont = null
      const r = rest.match(/^@(\w+)@ (\w+)$/)
      if (r && r[2] === 'INDI') {
        ctype = 'INDI'
        if (!indi.has(r[1])) indi.set(r[1], {
          id: r[1], name: '', surn: '', giv: '', sex: '',
          birt: {}, deat: {}, events: [], famc: null, parentFams: [], fams: [], media: [], notes: [], sources: [],
        })
        cur = indi.get(r[1])
      } else if (r && r[2] === 'FAM') {
        ctype = 'FAM'
        if (!fam.has(r[1])) fam.set(r[1], { id: r[1], husb: null, wife: null, chil: [], marr: {} })
        cur = fam.get(r[1])
      } else if (r && r[2] === 'OBJE') {
        ctype = 'OBJE'
        cur = { file: '', title: '', form: '' }
        obje.set(r[1], cur)
      } else if (r && r[2] === 'SOUR') {
        ctype = 'SOUR'
        cur = { title: '' }
        sour.set(r[1], cur)
      }
      continue
    }
    if (cur === null) continue
    const sp = rest.indexOf(' ')
    const tag = sp < 0 ? rest : rest.slice(0, sp)
    let val = sp < 0 ? '' : rest.slice(sp + 1)
    const note = tag === 'NOTE' && !/^@\w+@$/.test(val)
    if (val.startsWith('@@')) val = val.slice(1)
    if (cont && lvl <= cont.lvl) cont = null
    if (tag === 'CONT') {
      if (cont?.lvl === lvl - 1) cont.obj[cont.key] += '\n' + val
      continue
    }
    if (lvl === 2) sub = tag
    if (cite && lvl <= citeLvl) cite = null
    const phrase = lvl === 3 && sub === 'DATE' && tag === 'PHRASE'
    if (cite) {
      if (lvl === citeLvl + 1 && tag === 'PAGE') {
        cite.page = val.trim()
        cont = { lvl, obj: cite, key: 'page' }
      }
      else if (lvl === citeLvl + 1 && note) cont = { lvl, obj: cite.notes, key: cite.notes.push(val) - 1 }
      else if (lvl === citeLvl + 2 && sub === 'DATA' && tag === 'TEXT') {
        cite.text = cite.text ? `${cite.text}\n${val}` : val
        cont = { lvl, obj: cite, key: 'text' }
      }
      if (lvl === citeLvl + 1) sub = tag
      continue
    }
    if (ctype === 'SOUR') {
      if (lvl === 1 && tag === 'TITL') {
        cur.title = val
        cont = { lvl, obj: cur, key: 'title' }
      }
    } else if (ctype === 'OBJE') {
      if (lvl === 1) {
        media = tag === 'FILE' && !cur.file ? cur : null
        if (media) media.file = val.trim()
      } else if (lvl === 2 && media) {
        if (tag === 'TITL') media.title = val.trim()
        else if (tag === 'FORM') media.form = val.trim()
      }
    } else if (ctype === 'INDI') {
      if (lvl === 1) {
        evt = famc = link = null
        shownName = tag === 'NAME' && !cur.name
        if (shownName) {
          cur.name = val.replaceAll('/', '').trim()
          const s = val.match(/\/([^/]*)\//)
          cur.surn = s ? s[1].trim() : ''
          cur.giv = val.replace(/\/[^/]*\//g, '').trim()
        } else if (tag === 'SEX') cur.sex = val.trim()
        else if (EVENTS.has(tag)) {
          evt = { tag, val: val.trim() }
          cur.events.push(evt)
        } else if (tag === 'FAMC') {
          famc = parentLink(stripAt(val))
          cur.parentFams.push(famc)
        }
        else if (tag === 'FAMS') cur.fams.push(stripAt(val))
        else if (tag === 'OBJE') cur.media.push(link = { id: stripAt(val) })
        else if (note) cont = { lvl, obj: cur.notes, key: cur.notes.push(val) - 1 }
        else if (tag === 'SOUR') startCitation(val, 1, cur.sources)
      } else if (lvl === 2 && tag === 'SOUR' && (evt || shownName)) {
        startCitation(val, 2, evt ? (evt.sources ??= []) : cur.sources)
      } else if (evt && lvl === 2) {
        if (tag === 'DATE') evt.date = val.trim()
        else if (tag === 'PLAC') evt.plac = val.trim()
        else if (tag === 'TYPE') evt.type = val.trim()
        else if (tag === 'RESN') evt.resn = val.trim()
        else if (note) cont = { lvl, obj: (evt.notes ??= []), key: evt.notes.push(val) - 1 }
      } else if (evt && phrase) {
        evt.phrase = val.trim()
      } else if (link && lvl === 2) {
        if (tag === 'TITL') link.caption = val.trim()
        else if (tag === 'CROP') link.crop = {}
      } else if (link?.crop && lvl === 3 && sub === 'CROP' && CROP.has(tag) && /^\d+$/.test(val.trim())) {
        link.crop[tag.toLowerCase()] = Number(val)
      } else if (famc && lvl === 2 && (tag === 'PEDI' || tag === 'STAT')) {
        famc[tag.toLowerCase()] = val.trim().toUpperCase()
      } else if (famc && lvl === 3 && sub === 'PEDI' && tag === 'PHRASE') {
        famc.phrase = val.trim()
      }
    } else {
      if (lvl === 1) {
        evt = null
        if (tag === 'HUSB') cur.husb = stripAt(val)
        else if (tag === 'WIFE') cur.wife = stripAt(val)
        else if (tag === 'CHIL') cur.chil.push(stripAt(val))
        else if (tag === 'MARR') evt = cur.marr
      } else if (evt && lvl === 2) {
        if (tag === 'DATE') evt.date = val.trim()
        else if (tag === 'PLAC') evt.plac = val.trim()
        else if (tag === 'RESN') evt.resn = val.trim()
      } else if (evt && phrase) evt.phrase = val.trim()
    }
  }
  for (const c of pointers) c.title = sour.get(c.sour)?.title ?? ''
  for (const p of indi.values()) {
    for (const [key, tag] of [['birt', 'BIRT'], ['deat', 'DEAT']]) {
      const all = p.events.filter(e => e.tag === tag)
      p[key] = all.find(e => !restricted(e) && yr(e.date)) ?? all[0] ?? {}
    }
    p.media = p.media.flatMap(({ id, ...own }) => (obje.has(id) ? { ...obje.get(id), ...own } : []))
  }
  const warnings = checkLinks(indi, fam)
  for (const p of indi.values()) p.famc = p.parentFams.find(l => l.stat !== 'DISPROVEN' && fam.has(l.fam))?.fam ?? null
  return { indi, fam, warnings }
}

export const parentLink = fam => ({ fam, pedi: '', phrase: '', stat: '' })

// Children in a family whose main parent family it is; ids with no record stay in.
export const mainChildren = (f, indi) => f.chil.filter(c => !indi.has(c) || indi.get(c).famc === f.id)

// Warns about links recorded on one side only, and shows a child link on both sides,
// marked with the side that recorded it (only: 'child' or 'family').
function checkLinks(indi, fam) {
  const warnings = []
  const warn = (from, tag, to, back) => warnings.push(`${from} ${tag} @${to}@ has no matching ${back} in ${to}`)
  for (const p of indi.values()) {
    for (const link of p.parentFams) {
      const fid = link.fam
      const f = fam.get(fid)
      if (f?.chil.includes(p.id)) continue
      warn(p.id, 'FAMC', fid, 'CHIL')
      if (!f) continue
      link.only = 'child'
      f.chil.push(p.id)
    }
    for (const fid of p.fams) {
      const f = fam.get(fid)
      if (f?.husb !== p.id && f?.wife !== p.id) warn(p.id, 'FAMS', fid, 'HUSB or WIFE')
    }
  }
  for (const f of fam.values()) {
    for (const [tag, id] of [['HUSB', f.husb], ['WIFE', f.wife]]) {
      if (id && !indi.get(id)?.fams.includes(f.id)) warn(f.id, tag, id, 'FAMS')
    }
    for (const c of f.chil) {
      const p = indi.get(c)
      if (p?.parentFams.some(l => l.fam === f.id)) continue
      warn(f.id, 'CHIL', c, 'FAMC')
      p?.parentFams.push({ ...parentLink(f.id), only: 'family' })
    }
  }
  return warnings
}

const stripAt = s => s.replace(/^@+|@+$/g, '')
