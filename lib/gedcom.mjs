// Minimal GEDCOM 7.0 reader: only what the site renders.

const EVENTS = new Set(['BIRT', 'CHR', 'BAPM', 'DEAT', 'BURI', 'RESI', 'EMIG', 'OCCU', 'EVEN'])

export function parseGedcom(text) {
  const indi = new Map(), fam = new Map(), obje = new Map(), sour = new Map(), pointers = []
  let cur = null, ctype = null, evt = null, media = null, sub = null, cite = null, citeLvl = 0, cont = null, shownName = false
  const startCitation = (val, lvl, list) => {
    cite = { title: '', page: '', text: '', notes: [] }
    citeLvl = lvl
    list.push(cite)
    const ptr = val.match(/^@(\w+)@$/)
    if (ptr) pointers.push([cite, ptr[1]])
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
      cur = ctype = evt = media = cite = cont = null
      const r = rest.match(/^@(\w+)@ (\w+)$/)
      if (r && r[2] === 'INDI') {
        ctype = 'INDI'
        if (!indi.has(r[1])) indi.set(r[1], {
          id: r[1], name: '', surn: '', giv: '', sex: '',
          birt: {}, deat: {}, events: [], famc: null, fams: [], media: [], notes: [], sources: [],
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
      if (lvl === citeLvl + 1 && tag === 'PAGE') cite.page = val.trim()
      else if (lvl === citeLvl + 1 && tag === 'NOTE') cont = { lvl, obj: cite.notes, key: cite.notes.push(val) - 1 }
      else if (lvl === citeLvl + 2 && sub === 'DATA' && tag === 'TEXT') {
        cite.text = val
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
        evt = null
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
          if (tag === 'BIRT' && !cur.birt.tag) cur.birt = evt
          if (tag === 'DEAT' && !cur.deat.tag) cur.deat = evt
        } else if (tag === 'FAMC') cur.famc = stripAt(val)
        else if (tag === 'FAMS') cur.fams.push(stripAt(val))
        else if (tag === 'OBJE') cur.media.push(stripAt(val))
        else if (tag === 'NOTE') cont = { lvl, obj: cur.notes, key: cur.notes.push(val) - 1 }
        else if (tag === 'SOUR') startCitation(val, 1, cur.sources)
      } else if (lvl === 2 && tag === 'SOUR' && (evt || shownName)) {
        startCitation(val, 2, evt ? (evt.sources ??= []) : cur.sources)
      } else if (evt && lvl === 2) {
        if (tag === 'DATE') evt.date = val.trim()
        else if (tag === 'PLAC') evt.plac = val.trim()
        else if (tag === 'TYPE') evt.type = val.trim()
        else if (tag === 'RESN') evt.resn = val.trim()
        else if (tag === 'NOTE') cont = { lvl, obj: (evt.notes ??= []), key: evt.notes.push(val) - 1 }
      } else if (evt && phrase) {
        evt.phrase = val.trim()
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
  for (const [c, id] of pointers) c.title = sour.get(id)?.title ?? ''
  for (const p of indi.values()) {
    p.media = p.media.flatMap(id => obje.get(id) ?? [])
  }
  return { indi, fam }
}

const stripAt = s => s.replace(/^@+|@+$/g, '')
