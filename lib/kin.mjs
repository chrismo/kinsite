// Shortest parent/child path from anyone to the primary person (BFS).

export class Kin {
  constructor(indi, fam, primaryId) {
    this.indi = indi
    this.fam = fam
    this.primary = indi.has(primaryId) ? primaryId : indi.has('I1') ? 'I1' : (indi.keys().next().value ?? null)
    this.prev = new Map()
    if (this.primary === null) return
    this.prev.set(this.primary, null)
    const queue = [this.primary]
    for (let i = 0; i < queue.length; i++) {
      for (const v of this.neighbors(queue[i])) {
        if (!this.prev.has(v)) {
          this.prev.set(v, queue[i])
          queue.push(v)
        }
      }
    }
  }

  parentsOf(pid) {
    const p = this.indi.get(pid)
    if (p && this.fam.has(p.famc)) {
      const f = this.fam.get(p.famc)
      return [f.husb, f.wife]
    }
    return [null, null]
  }

  childrenOf(pid) {
    const kids = []
    for (const fid of this.indi.get(pid)?.fams ?? []) {
      const f = this.fam.get(fid)
      if (f) kids.push(...f.chil)
    }
    return kids
  }

  neighbors(pid) {
    return [...this.parentsOf(pid).filter(Boolean), ...this.childrenOf(pid)]
  }

  /** [x, ..., primary], or null for the primary person and the unconnected */
  relPath(x) {
    if (x === this.primary || !this.prev.has(x)) return null
    const chain = [x]
    while (chain.at(-1) !== this.primary) chain.push(this.prev.get(chain.at(-1)))
    return chain
  }

  /** direction of b relative to a */
  hop(a, b) {
    if (this.parentsOf(a).includes(b)) return '&uarr;'
    if (this.parentsOf(b).includes(a)) return '&darr;'
    return '&middot;'
  }
}
