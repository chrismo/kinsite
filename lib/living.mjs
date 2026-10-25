// Living people on a public site: kept in the tree for its shape, shown only as "Private".

export function isLiving(p, year = new Date().getFullYear()) {
  if (p.deat?.tag) return false
  const years = (p.birt?.date ?? '').match(/\d{4}/g)
  return !years || year - Math.max(...years) <= 100
}

const stub = ({ id, famc, fams }) => ({
  id, name: 'Private', surn: '', giv: '', sex: '', private: true,
  birt: {}, deat: {}, events: [], famc, fams, media: [], notes: [],
})

export function anonymize(indi, fam, year) {
  const living = new Set([...indi.values()].filter(p => isLiving(p, year)).map(p => p.id))
  return {
    indi: new Map([...indi].map(([id, p]) => [id, living.has(id) ? stub(p) : p])),
    fam: new Map([...fam].map(([id, f]) => [id, living.has(f.husb) || living.has(f.wife) ? { ...f, marr: {} } : f])),
  }
}
