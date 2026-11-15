// Living people on a public site: kept in the tree for its shape, shown only as "Private".
import { parentLink } from './gedcom.mjs'

export function isLiving(p, year = new Date().getFullYear()) {
  if (p.deat?.tag) return false
  const births = [p.birt, ...(p.events ?? []).filter(e => e.tag === 'BIRT')]
  const years = births.flatMap(e => e?.date?.match(/\d{4}/g) ?? [])
  return !years.length || year - Math.max(...years) <= 100
}

// A Private person keeps only the main parent family, without PEDI or STAT.
const stub = ({ id, famc, fams }) => ({
  id, name: 'Private', surn: '', giv: '', sex: '', private: true,
  birt: {}, deat: {}, events: [], famc, parentFams: famc ? [parentLink(famc)] : [], fams, media: [], notes: [], sources: [],
})

export function anonymize(indi, fam, year) {
  const living = new Set([...indi.values()].filter(p => isLiving(p, year)).map(p => p.id))
  const withheld = new Set([...indi.values()].filter(p => living.has(p.id)).flatMap(p => p.media.map(m => m.file)))
  const keep = p => {
    const media = p.media.filter(m => !withheld.has(m.file))
    const parentFams = p.parentFams?.filter(l => l.stat !== 'DISPROVEN')
    return media.length < p.media.length || parentFams?.length < p.parentFams?.length ? { ...p, media, parentFams } : p
  }
  const people = new Map([...indi].map(([id, p]) => [id, living.has(id) ? stub(p) : keep(p)]))
  const listed = (c, f) => people.get(c)?.parentFams?.some(l => l.fam === f.id) ?? true
  const shown = f => {
    const chil = f.chil.filter(c => listed(c, f))
    const g = chil.length < f.chil.length ? { ...f, chil } : f
    return living.has(f.husb) || living.has(f.wife) ? { ...g, marr: {} } : g
  }
  return { indi: people, fam: new Map([...fam].map(([id, f]) => [id, shown(f)])) }
}
