// What changed on the site between two GEDCOMs: records as data, sentences under one build's rules.
import fs from 'node:fs'
import path from 'node:path'
import { parseGedcom, restricted } from './gedcom.mjs'
import { isLiving } from './living.mjs'
import { place, redact } from './redact.mjs'
import { when, known, cited, linkLabel as label, ONCE, IMG_EXT } from './render.mjs'

const NOUNS = {
  BIRT: 'birth', CHR: 'christening', BAPM: 'baptism', DEAT: 'death', BURI: 'burial',
  RESI: 'residence', EMIG: 'emigration', OCCU: 'occupation',
}

const fact = e => ({
  tag: e.tag, type: e.type ?? '', val: e.val ?? '', date: e.date ?? '', phrase: e.phrase ?? '', plac: e.plac ?? '', resn: e.resn ?? '',
})
const factKey = e => JSON.stringify({ ...fact(e), resn: restricted(e) })
const citeKey = c => `${c.sour || c.title}\n${c.page}`
const sameCite = (a, b) => citeKey(a) === citeKey(b) && a.text === b.text && a.notes.join('\n') === b.notes.join('\n')
const near = (a, b) => (a.date && a.date === b.date) || (a.plac && a.plac === b.plac)
const spouses = f => (f ? [f.husb, f.wife].filter(Boolean) : [])
const union = (a, b) => [...new Set([...a, ...b])]

function match(olds, news, same, near = () => false) {
  const left = [...olds], pairs = [], rest = []
  const take = (n, ok) => {
    const i = left.findIndex(o => ok(o, n))
    return i < 0 ? null : left.splice(i, 1)[0]
  }
  for (const n of news) {
    const o = take(n, same)
    if (o) pairs.push([o, n, true])
    else rest.push(n)
  }
  const added = []
  for (const n of rest) {
    const o = take(n, near)
    if (o) pairs.push([o, n, false])
    else added.push(n)
  }
  pairs.sort((a, b) => news.indexOf(a[1]) - news.indexOf(b[1]))
  return { pairs, removed: left, added }
}

// preferred is [was, now] when another version became the first shown.
function versions(olds, news, close = near) {
  const m = match(olds, news, (a, b) => factKey(a) === factKey(b), close)
  const was = olds.find(e => !restricted(e)), now = news.find(e => !restricted(e))
  const counterpart = m.pairs.find(([a]) => a === was)?.[1]
  return { ...m, preferred: counterpart && now && counterpart !== now && !restricted(counterpart) ? [counterpart, now] : null }
}

export function diffTrees(old, cur) {
  const gone = [...old.indi.keys()].filter(id => !cur.indi.has(id))
  if (gone.length * 2 > old.indi.size) {
    throw new Error(`xrefs look renumbered: ${gone.length} of ${old.indi.size} people in the old file are missing from the new one`)
  }
  const out = []
  for (const [id, p] of cur.indi) {
    if (old.indi.has(id)) out.push(...personChanges(old.indi.get(id), p, old, cur))
    else out.push({ kind: 'person', op: 'added', id })
  }
  for (const fid of union(cur.fam.keys(), old.fam.keys())) out.push(...marriageChanges(fid, old.fam.get(fid), cur.fam.get(fid)))
  for (const id of gone) out.push({ kind: 'person', op: 'removed', id, was: structuredClone(old.indi.get(id)) })
  return out
}

function personChanges(o, p, old, cur) {
  const id = p.id, out = []
  const push = (kind, op, from, to, extra) =>
    out.push({ kind, op, id, ...extra, ...(from !== undefined && { from }), ...(to !== undefined && { to }) })
  if (o.name !== p.name) push('name', 'changed', o.name, p.name)

  const notes = (olds, news, event) => {
    const text = ns => (ns ?? []).filter(n => n.trim())
    const { removed, added } = match(text(olds), text(news), (a, b) => a === b)
    if (removed.length === 1 && added.length === 1) return push('note', 'changed', removed[0], added[0], { event })
    for (const n of removed) push('note', 'removed', n, undefined, { event })
    for (const n of added) push('note', 'added', undefined, n, { event })
  }
  const cites = (olds, news, event) => {
    const shown = cs => (cs ?? []).filter(cited)
    const { pairs, removed, added } = match(shown(olds), shown(news), sameCite, (a, b) => citeKey(a) === citeKey(b))
    for (const [a, b, same] of pairs) if (!same) push('citation', 'changed', structuredClone(a), structuredClone(b), { event })
    for (const c of removed) push('citation', 'removed', structuredClone(c), undefined, { event })
    for (const c of added) push('citation', 'added', undefined, structuredClone(c), { event })
  }

  const group = e => (e.tag === 'EVEN' ? `EVEN ${e.type ?? ''}` : e.tag)
  for (const g of union(o.events.map(group), p.events.map(group))) {
    const olds = o.events.filter(e => group(e) === g), news = p.events.filter(e => group(e) === g)
    const { pairs, removed, added, preferred } = versions(olds, news)
    for (const [a, b, same] of pairs) {
      if (!same) push('event', 'changed', fact(a), fact(b))
      if (restricted(a)) continue
      notes(a.notes, b.notes, fact(b))
      cites(a.sources, b.sources, fact(b))
    }
    for (const e of removed) push('event', 'removed', fact(e))
    for (const e of added) push('event', 'added', undefined, fact(e))
    if (ONCE.has(g) && preferred) push('preferred', 'changed', ...preferred.map(fact))
  }
  notes(o.notes, p.notes)
  cites(o.sources, p.sources)

  const obje = ({ file, title, form }) => ({ file, title, form })
  const media = match(o.media, p.media, (a, b) => a.file === b.file && a.title === b.title, (a, b) => a.file === b.file)
  for (const [a, b, same] of media.pairs) if (!same) push('media', 'changed', obje(a), obje(b))
  for (const m of media.removed) push('media', 'removed', obje(m))
  for (const m of media.added) push('media', 'added', undefined, obje(m))

  // Which side of the file records a link (only) is bookkeeping, not a change to report.
  const links = q => new Map(q.parentFams.map(({ only, ...l }) => [l.fam, l]))
  const was = links(o), now = links(p)
  if (p.famc && p.famc !== o.famc) push('parents', 'main', undefined, undefined, { fam: p.famc, parents: spouses(cur.fam.get(p.famc)) })
  for (const fam of union(was.keys(), now.keys())) {
    const a = was.get(fam), b = now.get(fam)
    const parents = spouses((b ? cur : old).fam.get(fam))
    if (a && b) {
      if (label(a) !== label(b)) push('parents', 'changed', { ...a }, { ...b }, { fam, parents })
    } else if (b) {
      if (fam !== p.famc) push('parents', 'added', undefined, { ...b }, { fam, parents })
    } else if (fam !== o.famc || !p.famc) push('parents', 'removed', { ...a }, undefined, { fam, parents })
  }
  return out
}

// A record with marr is a whole marriage added or removed; one with from or to is a version of it.
function marriageChanges(fam, a, b) {
  const was = spouses(a), now = spouses(b)
  const marr = f => fact(f.marrs.find(e => !restricted(e)) ?? f.marrs[0] ?? { tag: 'MARR' })
  if (was.length === 2 && now.length === 2 && was[0] === now[0] && was[1] === now[1]) {
    const only = a.marrs.length === 1 && b.marrs.length === 1
    const { pairs, removed, added, preferred } = versions(a.marrs, b.marrs, only ? () => true : near)
    const rec = (op, from, to) => ({ kind: 'marriage', op, fam, spouses: now, ...(from && { from: fact(from) }), ...(to && { to: fact(to) }) })
    return [...pairs.filter(([, , same]) => !same).map(([x, y]) => rec('changed', x, y)),
      ...removed.map(e => rec('removed', e)), ...added.map(e => rec('added', null, e)),
      ...(preferred ? [rec('preferred', ...preferred)] : [])]
  }
  return [[a, was, 'removed'], [b, now, 'added']].filter(([, pair]) => pair.length === 2)
    .map(([f, pair, op]) => ({ kind: 'marriage', op, fam, spouses: pair, marr: marr(f) }))
}

export function describe(records, tree, { anonymizeLiving = false, notes = true, citations = true } = {}, { year } = {}) {
  const people = op => records.filter(r => r.kind === 'person' && r.op === op)
  const removed = new Map(people('removed').map(r => [r.id, r.was])), added = new Set(people('added').map(r => r.id))
  const person = id => tree.indi.get(id) ?? removed.get(id)
  const hidden = id => anonymizeLiving && (!person(id) || isLiving(person(id), year))
  const name = id => person(id)?.name || '(unnamed)'
  const names = ids => ids.map(name).join(' and ')
  const quote = !anonymizeLiving
  const withheld = new Set(anonymizeLiving
    ? [...tree.indi.values(), ...removed.values()].filter(p => isLiving(p, year)).flatMap(p => p.media.map(m => m.file)) : [])
  const order = new Map([...tree.indi.keys()].map((id, i) => [id, i]))
  const first = ids => [...ids].sort((a, b) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity))[0]

  const items = [], groups = new Map()
  const under = (id, line) => {
    if (!groups.has(id)) {
      groups.set(id, { id, text: `${name(id)} (${id})`, lines: [] })
      items.push(groups.get(id))
    }
    groups.get(id).lines.push(line)
  }

  const folded = new Map()
  for (const r of records) {
    if (r.kind !== 'marriage' || !r.marr || r.spouses.some(hidden)) continue
    const who = r.spouses.find(id => (r.op === 'added' ? added : removed).has(id))
    if (who) folded.set(r, who)
  }
  const marriagesOf = id => {
    const partners = [...folded].filter(([, who]) => who === id).map(([r]) => r.spouses.find(s => s !== id))
    if (!partners.length) return ''
    const pron = { M: 'his', F: 'her' }[person(id).sex] ?? 'their'
    return ` and ${pron} marriage${partners.length > 1 ? 's' : ''} to ${names(partners)}`
  }

  const noun = e => (e.tag === 'MARR' ? 'marriage' : e.tag !== 'EVEN' ? NOUNS[e.tag] : e.type === 'Living' ? 'residence' : e.type || 'event')
  const article = w => (/^[aeiou]/i.test(w) ? 'an' : 'a')
  const where = e => place(known(e.plac)).replace(/[, ]+$/, '')
  const bits = e => [known(e.val) !== 'Y' && known(e.val), when(e), where(e)].filter(Boolean).join(', ')
  const factText = e => [noun(e), bits(e)].filter(Boolean).join(' ')
  const changed = (from, to, what) => {
    const field = from.val !== to.val ? '' : from.plac === to.plac ? 'date' : from.date === to.date && from.phrase === to.phrase ? 'place' : ''
    const show = e => ({ date: when, place: where }[field] ?? bits)(e) || 'none'
    return `Changed ${what(field)} ${quote && !restricted(from) ? `from ${show(from)} ` : ''}to ${show(to)}`
  }
  const citeText = c => [c.title.trim(), c.page.trim(), c.text.trim() && `“${c.text.trim()}”`].filter(Boolean).join(', ')
  const mediaKind = m => (IMG_EXT.has(path.extname(m.file).toLowerCase()) ? 'photo' : 'document')

  const line = r => {
    const ctx = prep => (r.event ? ` ${prep} the ${noun(r.event)}` : '')
    const { from, to } = r
    if (r.event && restricted(r.event)) return null
    switch (r.kind) {
      case 'name':
        return quote ? `Changed name from ${from} to ${to}` : `Changed name to ${to}`
      case 'event':
        if ((to && restricted(to)) || (!to && restricted(from))) return null
        if (!from || restricted(from)) return `Added: ${factText(to)}`
        if (!to) return quote ? `Removed: ${factText(from)}` : `Removed ${article(noun(from))} ${noun(from)} record`
        return changed(from, to, field => [noun(to), field].filter(Boolean).join(' '))
      case 'preferred':
        return `Preferred ${noun(to)} is now ${bits(to)}` + (quote ? `, not ${bits(from)}` : '')
      case 'note': {
        if (!notes) return null
        const text = n => `“${n.replace(/\s+/g, ' ').trim()}”`
        if (r.op === 'added') return `Added a note${ctx('to')}: ${text(to)}`
        if (r.op === 'removed') return `Removed a note${ctx('from')}` + (quote ? `: ${text(from)}` : '')
        return `Changed a note${ctx('on')} to ${text(to)}`
      }
      case 'citation':
        if (!citations) return null
        if (r.op === 'added') return `Added a citation${ctx('to')}: ${citeText(to)}`
        if (r.op === 'removed') return `Removed a citation${ctx('from')}` + (quote ? `: ${citeText(from)}` : '')
        return `Changed a citation${ctx('on')}: ${citeText(to)}`
      case 'media': {
        const m = to ?? from, title = x => x.title || path.basename(x.file)
        if (withheld.has(m.file)) return null
        if (r.op === 'added') return `Added a ${mediaKind(m)}: ${title(m)}`
        if (r.op === 'removed') return `Removed a ${mediaKind(m)}` + (quote ? `: ${title(m)}` : '')
        return `Retitled a ${mediaKind(m)} ${quote ? `from ${title(from)} ` : ''}to ${title(to)}`
      }
      case 'parents': {
        if (r.parents.some(hidden)) return null
        const who = names(r.parents) || 'unrecorded parents'
        let op = r.op
        if (anonymizeLiving && op !== 'main') {
          const seen = l => !!l && l.stat !== 'DISPROVEN', before = seen(from), after = seen(to)
          if (!before && !after) return null
          if (before !== after) op = after ? 'added' : 'removed'
          if (op === 'added' && r.fam === person(r.id).famc) return null
        }
        if (op === 'main') return `Now listed as a child of ${who}`
        if (op === 'added') return `Now also listed as a child of ${who}` + (label(to) ? ` (${label(to)})` : '')
        if (op === 'removed') return `No longer listed as a child of ${who}`
        return `Relabeled as a child of ${who} from ${label(from) || 'no label'} to ${label(to) || 'no label'}`
      }
    }
  }

  for (const r of records) {
    if (r.kind === 'person') {
      if (hidden(r.id)) continue
      const p = person(r.id), parents = r.op === 'added' ? spouses(tree.fam.get(p.famc)) : []
      const child = parents.length && !parents.some(hidden) ? `, a child of ${names(parents)}` : ''
      const wed = marriagesOf(r.id)
      items.push({ id: r.id, text: `${r.op === 'added' ? 'Added' : 'Removed'}: ${name(r.id)} (${r.id})${child}${child && wed && ','}${wed}`, lines: [] })
    } else if (r.kind === 'marriage') {
      if (folded.has(r) || r.spouses.some(hidden)) continue
      const id = first(r.spouses), other = name(r.spouses.find(s => s !== id))
      const m = r.marr ?? r.to ?? r.from, details = restricted(m) || !bits(m) ? '' : `, ${bits(m)}`
      if (r.op === 'preferred') under(id, `Preferred marriage to ${other} is now ${bits(r.to)}` + (quote ? `, not ${bits(r.from)}` : ''))
      else if (r.op === 'changed') {
        if (!restricted(r.to)) under(id, changed(r.from, r.to, field => [field, field && 'of', 'the marriage to', other].filter(Boolean).join(' ')))
      } else if (!r.marr && restricted(m)) continue
      else if (r.op === 'added') under(id, `Added: marriage to ${other}${details}`)
      else under(id, quote ? `Removed: marriage to ${other}${details}` : `Removed ${r.marr ? 'a' : 'a record of the'} marriage to ${other}`)
    } else if (!hidden(r.id)) {
      const text = line(r)
      if (text) under(r.id, text)
    }
  }
  return items.map(i => ({ ...i, text: redact(i.text), lines: i.lines.map(redact) }))
}

export const formatChanges = items =>
  items.map(i => [i.text, ...i.lines.map(l => `  ${l}`)].join('\n')).join('\n') || 'No changes.'

export function readGedcom(f) {
  if (!fs.statSync(f, { throwIfNoEntry: false })?.isFile()) throw new Error(`GEDCOM not found: ${f}`)
  return parseGedcom(fs.readFileSync(f, 'utf8'))
}

export function changeReport(config, oldFile) {
  const old = readGedcom(oldFile), cur = readGedcom(config.gedcom)
  return formatChanges(describe(diffTrees(old, cur), cur, config))
}
