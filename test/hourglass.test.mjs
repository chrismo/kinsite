import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hourglassLayout, hourglassSvg, BOX } from '../lib/hourglass.mjs'
import { Renderer } from '../lib/render.mjs'

// Invented people. Quill: I10+I11 -> I2; Rook: I12+I13 -> I3; I2+I3 -> I1 (focus), I4, I5;
// I1+I6 -> I14, I15. I9 stands alone. Birch: I20's family F20 has children but no parents.
// Vale: I30 has six siblings, three spouses and seven children.
const P = (id, name, famc = null, fams = []) => [id, { id, name, famc, fams, birt: {}, deat: {} }]
const F = (id, husb, wife, chil = []) => [id, { id, husb, wife, chil, marr: {} }]
const indi = new Map([
  P('I10', 'Abner Quill', null, ['F10']), P('I11', 'Briony Quill', null, ['F10']),
  P('I12', 'Dorrit Rook', null, ['F11']), P('I13', 'Elspet Rook', null, ['F11']),
  P('I2', 'Corwin Quill', 'F10', ['F1']), P('I3', 'Fennel Rook', 'F11', ['F1']),
  P('I1', 'Gideon Quill', 'F1', ['F2']), P('I4', 'Hollis Quill', 'F1'), P('I5', 'Iona Quill', 'F1'),
  P('I6', 'Juniper Sedge', null, ['F2']), P('I14', 'Kestrel Quill', 'F2'), P('I15', 'Linnet Quill', 'F2'),
  P('I9', 'Merrow Vale'),
  P('I20', 'Nettle Birch', 'F20', ['F21']), P('I21', 'Orrin Birch', 'F20', ['F22']),
  P('I22', 'Pell Birch', null, ['F21']), P('I23', 'Quincey Birch', 'F21'), P('I24', 'Rowan Birch', 'F22'),
  P('I30', 'Saffron Vale', 'F30', ['F31', 'F32', 'F33']), P('I31', 'Thorne Vale', null, ['F30']), P('I32', 'Umber Vale', null, ['F30']),
  ...[33, 34, 35, 36, 38, 39].map(n => P(`I${n}`, `Sib${n} Vale`, 'F30')),
  P('I40', 'Verity Vale', null, ['F31']), P('I48', 'Wren Vale', null, ['F32']), P('I49', 'Yarrow Vale', null, ['F33']),
  ...[41, 42, 43, 44, 45, 46, 47].map(n => P(`I${n}`, `Kid${n} Vale`, 'F31')),
  // Zed: file order differs from birth order; I53 has no birth date.
  born(P('I50', 'Ash Zed', 'F50', ['F51']), '1950'), born(P('I51', 'Bay Zed', 'F50'), '1960'),
  born(P('I52', 'Cal Zed', 'F50'), 'ABT 1940'), P('I53', 'Dee Zed', 'F50'),
  born(P('I54', 'Eli Zed', 'F51'), '23 OCT 1981'), born(P('I55', 'Fen Zed', 'F51'), '1985'),
])
function born([id, p], date) {
  return [id, { ...p, birt: { date } }]
}
const fam = new Map([
  F('F10', 'I10', 'I11', ['I2']), F('F11', 'I12', 'I13', ['I3']),
  F('F1', 'I2', 'I3', ['I4', 'I1', 'I5']), F('F2', 'I1', 'I6', ['I14', 'I15']),
  F('F20', null, null, ['I20', 'I21']), F('F21', 'I22', 'I20', ['I23']), F('F22', null, 'I21', ['I24']),
  F('F30', 'I31', 'I32', ['I33', 'I34', 'I35', 'I30', 'I36', 'I38', 'I39']),
  F('F31', 'I30', 'I40', ['I41', 'I42', 'I43', 'I44', 'I45', 'I46', 'I47']), F('F32', 'I30', 'I48'), F('F33', 'I30', 'I49'),
  F('F50', null, null, ['I51', 'I50', 'I53', 'I52']), F('F51', 'I50', null, ['I55', 'I54']),
])
const tree = { indi, fam }

const rows = L => {
  const out = {}
  for (const b of [...L.boxes].sort((a, b) => a.y - b.y || a.x - b.x)) {
    (out[b.row] ??= []).push(b.id ?? b.text)
  }
  return out
}
const box = (L, id) => L.boxes.find(b => b.id === id)
const cx = b => b.x + BOX.w / 2

test('full neighborhood: grandparents and parents above, siblings and spouse beside, children below', () => {
  const L = hourglassLayout('I1', tree)
  assert.deepEqual(rows(L), {
    grand: ['I10', 'I11', 'I12', 'I13'],
    parent: ['I2', 'I3'],
    focus: ['I4', 'I1', 'I6', 'I5'],
    child: ['I14', 'I15'],
  })
  assert.equal(box(L, 'I1').kind, 'self')
  const self = cx(box(L, 'I1'))
  assert.equal((cx(box(L, 'I2')) + cx(box(L, 'I3'))) / 2, self, 'parents centred on the focus')
  assert.equal((cx(box(L, 'I10')) + cx(box(L, 'I11'))) / 2, cx(box(L, 'I2')), 'grandparents centred on their child')
  assert.equal((cx(box(L, 'I14')) + cx(box(L, 'I15'))) / 2, (self + cx(box(L, 'I6'))) / 2, 'children centred under the couple')
  assert.ok(L.edges.length >= 4, 'has connectors')
})

test('boxes never overlap and sit inside the chart', () => {
  for (const pid of ['I1', 'I2', 'I9', 'I20', 'I30', 'I10']) {
    const L = hourglassLayout(pid, tree)
    for (const a of L.boxes) {
      assert.ok(a.x >= 0 && a.x + BOX.w <= L.width && a.y >= 0 && a.y + BOX.h <= L.height, `${pid}: ${a.id} inside`)
      for (const b of L.boxes) {
        if (a === b || a.y !== b.y) continue
        assert.ok(a.x + BOX.w <= b.x || b.x + BOX.w <= a.x, `${pid}: ${a.id ?? a.text} overlaps ${b.id ?? b.text}`)
      }
    }
  }
})

test('long sibling, spouse and child lists are capped with a "+N more" box', () => {
  const L = hourglassLayout('I30', tree)
  const r = rows(L)
  assert.deepEqual(r.focus, ['I33', 'I34', 'I35', 'I30', 'I40', '+2 more', 'I36', 'I38', 'I39'])
  assert.deepEqual(r.child, ['I41', 'I42', 'I43', '+4 more'])
  assert.deepEqual(r.parent, ['I31', 'I32'])
  assert.equal(L.boxes.filter(b => b.kind === 'more').length, 2)
})

test('siblings keep family order around the focus, nearest first, so the next ones scroll into view on each click', () => {
  // I30's family: I33 I34 I35 I30 I36 I38 I39
  assert.deepEqual(rows(hourglassLayout('I33', tree)).focus, ['I33', 'I34', 'I35', '+4 more'])
  assert.deepEqual(rows(hourglassLayout('I35', tree)).focus, ['I33', 'I34', 'I35', 'I30', 'I36', '+2 more'])
  assert.deepEqual(rows(hourglassLayout('I39', tree)).focus, ['+4 more', 'I36', 'I38', 'I39'])
})

test('no recorded parents: siblings, spouse and children still show, with a stub where the parents go', () => {
  const L = hourglassLayout('I20', tree)
  assert.deepEqual(rows(L), {
    parent: ['no parents recorded'],
    focus: ['I20', 'I22', 'I21'],
    child: ['I23'],
  })
  assert.equal(box(L, 'I20').kind, 'self')
  assert.equal(L.boxes.find(b => b.kind === 'stub').x, box(L, 'I20').x)
})

test('a person with no relatives at all gets their own box and the stub', () => {
  const L = hourglassLayout('I9', tree)
  assert.deepEqual(rows(L), { parent: ['no parents recorded'], focus: ['I9'] })
  assert.equal(L.edges.length, 0)
})

test('one known parent sits directly above the focus; no grandparents means no top row', () => {
  const L = hourglassLayout('I24', tree)
  assert.deepEqual(rows(L), { parent: ['I21'], focus: ['I24'] })
  assert.equal(cx(box(L, 'I21')), cx(box(L, 'I24')))
  assert.deepEqual(rows(hourglassLayout('I2', tree)),
    { parent: ['I10', 'I11'], focus: ['I2', 'I3'], child: ['I4', 'I1', 'I5'] })
})

test('siblings and children sort by birth year, not GEDCOM order; undated ones go last', () => {
  const L = hourglassLayout('I50', tree)
  assert.deepEqual(rows(L).focus, ['I52', 'I50', 'I51', 'I53'])
  assert.deepEqual(rows(L).child, ['I54', 'I55'])
  assert.deepEqual(rows(hourglassLayout('I53', tree)).focus, ['I52', 'I50', 'I51', 'I53'])
})

test('svg links every person box to their page, truncates long names and labels stubs', () => {
  const label = id => [indi.get(id).name, id === 'I1' ? '1900–1980' : '']
  const svg = hourglassSvg(hourglassLayout('I1', tree), label)
  for (const id of ['I10', 'I11', 'I12', 'I13', 'I2', 'I3', 'I4', 'I5', 'I1', 'I6', 'I14', 'I15']) {
    assert.match(svg, new RegExp(`<a href="${id}\\.html">`), id)
  }
  assert.match(svg, /class="hg-self"/)
  assert.match(svg, /1900–1980/)
  assert.doesNotMatch(svg, /no parents recorded/)
  const sparse = hourglassSvg(hourglassLayout('I9', tree), label)
  assert.match(sparse, /<a href="I9\.html">/)
  assert.match(sparse, /no parents recorded/)
  assert.equal((sparse.match(/<a /g) ?? []).length, 1)
  const many = hourglassSvg(hourglassLayout('I30', tree), () => ['Philomena Araminta Thistlewood-Vale', ''])
  assert.match(many, /\+4 more/)
  assert.match(many, /Philomena Araminta Th…</)
  assert.doesNotMatch(many, /<a href="\.html"/)
})

test('personPage puts the chart under a Family heading and indexPage uses it as the hero', () => {
  const kin = { primary: 'I1', parentsOf: () => [null, null], childrenOf: () => [], relPath: () => null }
  const full = id => ({ ...indi.get(id), surn: '', giv: '', sex: '', events: [], media: [], notes: [] })
  const r = new Renderer({ indi: new Map([...indi.keys()].map(k => [k, full(k)])), fam, kin, copied: new Map() })
  const { html } = r.personPage('I9')
  assert.match(html, /<h2>Family<\/h2><div class="pedwrap"><svg [^>]*class="hg"/)
  assert.match(html, /no parents recorded/)
  assert.doesNotMatch(html, /<h2>Ancestors<\/h2>/)
  const index = r.indexPage()
  assert.match(index, /<h2>Family of Gideon Quill<\/h2><div class="pedwrap">/)
})
