// Living people on a public site: kept in the tree for its shape, shown only as "Private".
import { parentLink, allCitations } from './gedcom.mjs'

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
  const livingFam = f => living.has(f.husb) || living.has(f.wife)
  const withheld = new Set([
    ...[...indi.values()].filter(p => living.has(p.id)).flatMap(p => [...p.media, ...allCitations(p).flatMap(c => c.media ?? [])]),
    ...[...fam.values()].filter(livingFam).flatMap(f => f.media ?? []),
  ].map(m => m.file))
  const shared = m => withheld.has(m.file)
  const cites = list => (list?.some(c => c.media?.some(shared)) ? list.map(c => (c.media ? { ...c, media: c.media.filter(m => !shared(m)) } : c)) : list)
  const keep = p => {
    const media = p.media.filter(m => !shared(m))
    const parentFams = p.parentFams?.filter(l => l.stat !== 'DISPROVEN')
    const sources = cites(p.sources)
    const events = p.events?.map(e => {
      const s = cites(e.sources)
      return s === e.sources ? e : { ...e, sources: s }
    })
    const changed = media.length < p.media.length || parentFams?.length < p.parentFams?.length || sources !== p.sources ||
      events?.some((e, i) => e !== p.events[i])
    return changed ? { ...p, media, parentFams, sources, events } : p
  }
  const people = new Map([...indi].map(([id, p]) => [id, living.has(id) ? stub(p) : keep(p)]))
  const listed = (c, f) => people.get(c)?.parentFams?.some(l => l.fam === f.id) ?? true
  const shown = f => {
    const chil = f.chil.filter(c => listed(c, f))
    const media = livingFam(f) ? [] : f.media?.filter(m => !shared(m))
    const g = chil.length < f.chil.length || media?.length < f.media?.length ? { ...f, chil, media } : f
    return livingFam(f) ? { ...g, marrs: [] } : g
  }
  return { indi: people, fam: new Map([...fam].map(([id, f]) => [id, shown(f)])) }
}
