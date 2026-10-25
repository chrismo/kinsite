// Static SVG hourglass chart for one person: grandparents and parents above,
// siblings and spouses beside, children below. Long lists collapse into a
// "+N more" box so the chart stays a readable neighbourhood, never a whole tree.
import { esc } from './html.mjs'
import { byBirth } from './dates.mjs'

export const BOX = { w: 150, h: 44 }
export const CAPS = { sibs: 3, spouses: 2, kids: 4 } // sibs is per side of the focus
const HGAP = 18, VGAP = 34, PAD = 8
const STEP = BOX.w + HGAP
const NAME_CHARS = 22

// Up to `cap` boxes, keeping the ones nearest the focus; the rest become one "+N more".
function capped(list, cap, nearestLast = false) {
  if (list.length <= cap) return { shown: list, more: 0 }
  const n = cap - 1
  return { shown: nearestLast ? list.slice(-n) : list.slice(0, n), more: list.length - n }
}

export function hourglassLayout(pid, { indi, fam }, caps = CAPS) {
  const has = id => (id && indi.has(id) ? id : null)
  const parentsOf = id => {
    const f = fam.get(indi.get(id)?.famc)
    return f ? [has(f.husb), has(f.wife)].filter(Boolean) : []
  }
  const parents = parentsOf(pid)
  const chil = (fam.get(indi.get(pid)?.famc)?.chil ?? []).filter(c => c === pid || indi.has(c)).sort(byBirth(indi))
  const older = chil.slice(0, chil.indexOf(pid)), younger = chil.slice(chil.indexOf(pid) + 1)
  const spouses = [], kids = []
  for (const fid of indi.get(pid)?.fams ?? []) {
    const f = fam.get(fid)
    if (!f) continue
    const sp = has(f.husb === pid ? f.wife : f.husb)
    if (sp) spouses.push(sp)
    kids.push(...f.chil.filter(c => indi.has(c)))
  }
  kids.sort(byBirth(indi))
  const grands = parents.map(parentsOf)

  // cx is the box centre relative to the focus at 0, resolved to x once every row is placed.
  const boxes = [], edges = []
  const put = (row, cx, props) => {
    const b = { row, cx, ...props }
    boxes.push(b)
    return b
  }
  const person = (row, cx, id) => put(row, cx, { id, kind: 'person' })
  const more = (row, cx, n) => put(row, cx, { id: null, kind: 'more', text: `+${n} more` })

  // Focus row: [+N more] older siblings | focus | spouses [+N more] | younger siblings [+N more]
  const self = put('focus', 0, { id: pid, kind: 'self' })
  const O = capped(older, caps.sibs, true)
  const sibBoxes = O.shown.map((id, i) => person('focus', -(O.shown.length - i) * STEP, id))
  if (O.more) sibBoxes.unshift(more('focus', -(O.shown.length + 1) * STEP, O.more))
  const W = capped(spouses, caps.spouses)
  const spBoxes = W.shown.map((id, i) => person('focus', (i + 1) * STEP, id))
  if (W.more) spBoxes.push(more('focus', (W.shown.length + 1) * STEP, W.more))
  const Y = capped(younger, caps.sibs)
  let col = spBoxes.length
  for (const id of Y.shown) sibBoxes.push(person('focus', ++col * STEP, id))
  if (Y.more) sibBoxes.push(more('focus', ++col * STEP, Y.more))

  const K = capped(kids, caps.kids), nK = K.shown.length + (K.more ? 1 : 0)
  const kidX = i => (spouses.length === 1 ? STEP / 2 : 0) + (i - (nK - 1) / 2) * STEP
  const kidBoxes = K.shown.map((id, i) => person('child', kidX(i), id))
  if (K.more) kidBoxes.push(more('child', kidX(K.shown.length), K.more))

  let parBoxes = []
  if (parents.length === 2) {
    const spread = grands.some(g => g.length) ? 2 * STEP : STEP
    parBoxes = [person('parent', -spread / 2, parents[0]), person('parent', spread / 2, parents[1])]
  } else if (parents.length === 1) {
    parBoxes = [person('parent', 0, parents[0])]
  } else {
    put('parent', 0, { id: null, kind: 'stub', text: 'no parents recorded' })
  }
  const grandBoxes = parBoxes.map((pb, i) => {
    const g = grands[i]
    if (g.length === 2) return [person('grand', pb.cx - STEP / 2, g[0]), person('grand', pb.cx + STEP / 2, g[1])]
    return g.map(id => person('grand', pb.cx, id))
  })

  const rowNames = ['grand', 'parent', 'focus', 'child'].filter(r => boxes.some(b => b.row === r))
  const rowY = Object.fromEntries(rowNames.map((r, i) => [r, PAD + i * (BOX.h + VGAP)]))
  const shift = PAD + BOX.w / 2 - Math.min(...boxes.map(b => b.cx))
  for (const b of boxes) {
    b.x = b.cx + shift - BOX.w / 2
    b.y = rowY[b.row]
    delete b.cx
  }
  const width = Math.max(...boxes.map(b => b.x)) + BOX.w + PAD
  const height = PAD + rowNames.length * BOX.h + (rowNames.length - 1) * VGAP + PAD

  const mid = b => b.x + BOX.w / 2
  const midY = b => b.y + BOX.h / 2
  const couple = pair => {
    if (pair.length === 2) edges.push([pair[0].x + BOX.w, midY(pair[0]), pair[1].x, midY(pair[1])])
  }
  const descend = (from, children) => {
    if (!from.length || !children.length) return
    const x0 = from.length === 2 ? (mid(from[0]) + mid(from[1])) / 2 : mid(from[0])
    const y0 = from.length === 2 ? midY(from[0]) : from[0].y + BOX.h
    const bus = children[0].y - VGAP / 2
    const xs = children.map(mid)
    edges.push([x0, y0, x0, bus])
    edges.push([Math.min(x0, ...xs), bus, Math.max(x0, ...xs), bus])
    for (const c of children) edges.push([mid(c), bus, mid(c), c.y])
  }
  grandBoxes.forEach((g, i) => { couple(g); descend(g, [parBoxes[i]]) })
  couple(parBoxes)
  descend(parBoxes, [...sibBoxes, self])
  const row = [self, ...spBoxes]
  for (let i = 1; i < row.length; i++) couple([row[i - 1], row[i]])
  descend(spouses.length === 1 ? [self, spBoxes[0]] : [self], kidBoxes)

  return { boxes, edges, width, height }
}

const chars = s => Array.from(s)
const trunc = s => (chars(s).length <= NAME_CHARS ? s : chars(s).slice(0, NAME_CHARS - 1).join('').trimEnd() + '…')
const f1 = n => (Number.isInteger(n) ? String(n) : n.toFixed(1))

/** label(id) -> [name, years] */
export function hourglassSvg({ boxes, edges, width, height }, label) {
  const out = edges.map(([x1, y1, x2, y2]) =>
    `<path d="M${f1(x1)},${f1(y1)} L${f1(x2)},${f1(y2)}"/>`)
  for (const b of boxes) {
    const rect = cls => `<rect${cls ? ` class="${cls}"` : ''} x="${f1(b.x)}" y="${f1(b.y)}" width="${BOX.w}" height="${BOX.h}" rx="3"/>`
    if (b.id === null) {
      out.push(`<g class="hg-${b.kind}">${rect()}` +
        `<text x="${f1(b.x + BOX.w / 2)}" y="${f1(b.y + BOX.h / 2 + 4)}" text-anchor="middle">${esc(b.text)}</text></g>`)
      continue
    }
    const [name, years] = label(b.id)
    out.push(`<a href="${b.id}.html">${rect(b.kind === 'self' ? 'hg-self' : 'hg-box')}<title>${esc(name)}</title>` +
      `<text x="${f1(b.x + 8)}" y="${f1(b.y + 18)}">${esc(trunc(name))}</text>` +
      `<text x="${f1(b.x + 8)}" y="${f1(b.y + 34)}" class="hg-yr">${esc(years)}</text></a>`)
  }
  return `<div class="pedwrap"><svg viewBox="0 0 ${f1(width)} ${f1(height)}" width="${f1(width)}" ` +
    `height="${f1(height)}" xmlns="http://www.w3.org/2000/svg" class="hg">${out.join('')}</svg></div>`
}
