// Person page layout (#62): tagged, collapsible sections in a fixed order, folded events, an outline nav.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Renderer } from '../lib/render.mjs'
import { Kin } from '../lib/kin.mjs'

const person = (id, giv, date, extra = {}) => [id, {
  id, giv, surn: 'Wren', name: `${giv} Wren`, sex: '', famc: null, fams: [], parentFams: [],
  birt: date ? { date } : {}, deat: {}, events: [], media: [], notes: [], sources: [], ...extra,
}]

function busy(opts = {}) {
  const indi = new Map([
    person('I1', 'Ada', '1890', {
      fams: ['F2'], famc: 'F1', parentFams: [{ fam: 'F1', pedi: '', phrase: '', stat: '' }],
      events: [
        { tag: 'BIRT', val: '', date: '1890' },
        { tag: 'RESI', val: '', date: '1920', plac: 'Kettleby', notes: ['Lodger'], sources: [
          { title: 'Census', page: 'Sheet 4', text: '', notes: [], media: [{ obje: 'O3', file: 'census.jpg', title: 'Census sheet' }] },
          { title: 'Directory', page: 'p. 9', text: '', notes: [] },
        ] },
        { tag: 'OCCU', val: 'Weaver' },
      ],
      media: [{ obje: 'O1', file: 'ada.jpg', title: 'Ada' }, { obje: 'O2', file: 'card.jpg', title: 'Card', medi: 'CARD' }, { obje: 'O4', file: 'will.pdf', title: 'Will' }],
      notes: ['Kept bees.'],
      sources: [{ title: 'Parish chest', page: '', text: '', notes: [] }],
    }),
    person('I2', 'Bo', '1860', { fams: ['F1'] }),
    person('I3', 'Cy', '1892', { famc: 'F1', parentFams: [{ fam: 'F1', pedi: '', phrase: '', stat: '' }] }),
    person('I4', 'Di', '1888', { fams: ['F2'] }),
    person('I5', 'Ed', '1915', { famc: 'F2', parentFams: [{ fam: 'F2', pedi: '', phrase: '', stat: '' }] }),
  ])
  const fam = new Map([
    ['F1', { id: 'F1', husb: 'I2', wife: null, chil: ['I1', 'I3'], marrs: [], media: [] }],
    ['F2', { id: 'F2', husb: 'I4', wife: 'I1', chil: ['I5'], marrs: [], media: [] }],
  ])
  const copied = new Map(['ada.jpg', 'card.jpg', 'census.jpg', 'will.pdf'].map(f => [f, `media/${f}`]))
  return new Renderer({ indi, fam, kin: new Kin(indi, fam, 'I1'), copied, ...opts })
}

const sections = html => [...html.matchAll(/<section id=(\w+) class=sec><details open><summary><h2>([^<]+)<\/h2><\/summary>/g)].map(m => [m[1], m[2]])

test('each part of a person page is a section with one heading, in a fixed order', () => {
  const { html } = busy().personPage('I1')
  assert.deepEqual(sections(html), [
    ['tree', 'Family tree'], ['photos', 'Photos'], ['kin', 'Close family'], ['events', 'Life events'],
    ['records', 'Records'], ['notes', 'Notes'], ['descendants', 'Descendants'], ['documents', 'Documents'], ['sources', 'Sources'],
  ])
  assert.equal(html.match(/<h2>/g).length, 9)
  assert.equal(html.match(/<section /g).length, html.match(/<\/section>/g).length)
})

test('parents, spouse and children, and siblings are sub-headings under Close family', () => {
  const { html } = busy().personPage('I1')
  const kin = html.split('<section id=kin ')[1].split('</section>')[0]
  assert.deepEqual([...kin.matchAll(/<h3>(.*?)<\/h3>/g)].map(m => m[1]), ['Parents', 'Spouse &amp; children', 'Siblings'])
})

test('sections with nothing to show are left out', () => {
  const indi = new Map([person('I1', 'Ada', '1890')])
  const { html } = new Renderer({ indi, fam: new Map(), kin: new Kin(indi, new Map(), 'I1'), copied: new Map() }).personPage('I1')
  assert.deepEqual(sections(html).map(s => s[0]), ['tree'])
})

test('an outline nav links each section in order; a page of two sections or fewer has none', () => {
  const { html } = busy().personPage('I1')
  const nav = html.match(/<nav class=toc aria-label="On this page">(.*?)<\/nav>/)[1]
  assert.deepEqual([...nav.matchAll(/<a href="#(\w+)">([^<]+)<\/a>/g)].map(m => [m[1], m[2]]), sections(html))
  assert.ok(html.indexOf('<nav class=toc') < html.indexOf('<section '))
  const indi = new Map([person('I1', 'Ada', '1890')])
  const plain = new Renderer({ indi, fam: new Map(), kin: new Kin(indi, new Map(), 'I1'), copied: new Map() }).personPage('I1').html
  assert.doesNotMatch(plain, /<nav|toc/)
})

test('an event with sources or notes folds to one line that says what it holds', () => {
  const html = busy().personPage('I1').html
  assert.match(html, /<details class="evt fold"><summary><span class="lbl">Residence<\/span> 1920 &middot; Kettleby <span class=more>2 sources · 1 scan · notes<\/span><\/summary><div class=ev>/)
  assert.match(html, /<div class="evt"><span class="lbl">Occupation<\/span> Weaver<\/div>/)
  assert.match(html, /<div class="evt"><span class="lbl">Born<\/span> 1890<\/div>/)
})

test('the fold note follows the citations and notes settings', () => {
  assert.match(busy({ citations: false }).personPage('I1').html, /Kettleby <span class=more>notes<\/span>/)
  assert.match(busy({ notes: false }).personPage('I1').html, /Kettleby <span class=more>2 sources · 1 scan<\/span>/)
  const bare = busy({ citations: false, notes: false }).personPage('I1').html
  assert.match(bare, /<div class="evt"><span class="lbl">Residence<\/span> 1920 &middot; Kettleby<\/div>/)
  assert.doesNotMatch(bare, /class=all/)
})

test('a Show all sources button, hidden until the script runs, opens and closes every folded event', () => {
  const html = busy().personPage('I1').html
  assert.match(html, /<section id=events class=sec><details open><summary><h2>Life events<\/h2><\/summary><button type=button class=all aria-pressed=false hidden>Show all sources<\/button>/)
  const { B, folds } = run(html)
  assert.equal(B.hidden, false)
  B.h.click()
  assert.ok(folds.every(d => d.open))
  assert.equal(B.textContent, 'Hide all sources')
  assert.equal(B.getAttribute('aria-pressed'), 'true')
  B.h.click()
  assert.ok(folds.every(d => !d.open))
  assert.equal(B.textContent, 'Show all sources')
})

test('the outline marks the section in view, and following a link or a #hash opens a folded section', () => {
  const html = busy().personPage('I1').html
  const page = run(html, { hash: '#notes', tops: { tree: -900, photos: -500, kin: 100, events: 600 } })
  assert.ok(page.secs.notes.open, 'a hash on load opens its section')
  assert.deepEqual(page.links.filter(a => a.on).map(a => a.href), ['#kin'])
  page.secs.kin.open = false
  page.links.find(a => a.href === '#kin').h.click()
  assert.ok(page.secs.kin.open)
  page.secs.sources.open = false
  page.loc.hash = '#sources'
  page.win.hashchange()
  assert.ok(page.secs.sources.open)
  page.loc.hash = '#not a selector>'
  assert.doesNotThrow(() => page.win.hashchange())
})

// Runs the page's outline script against a small stand-in for the DOM.
function run(html, { hash = '', tops = {} } = {}) {
  const script = [...html.matchAll(/<script>([^]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('nav.toc'))
  assert.ok(script, 'the page has the outline script')
  const ids = sections(html).map(s => s[0])
  const el = (props = {}) => { const h = {}; return { h, ...props, addEventListener: (t, f) => { h[t] = f } } }
  const secs = Object.fromEntries(ids.map(id => [id, { open: true }]))
  const sectionEl = id => ({ getBoundingClientRect: () => ({ top: tops[id] ?? 2000 }), querySelector: s => (s === 'details' ? secs[id] : null) })
  const links = ids.map(id => el({ href: `#${id}`, on: false, getAttribute: () => `#${id}`, classList: { toggle(c, v) { if (c === 'on') links.find(a => a.href === `#${id}`).on = v } } }))
  const attrs = { 'aria-pressed': 'false' }
  const B = el({ hidden: true, textContent: 'Show all sources', getAttribute: k => attrs[k], setAttribute: (k, v) => { attrs[k] = String(v) } })
  const folds = (html.match(/<details class="evt fold">/g) ?? []).map(() => ({ open: false }))
  const win = {}, loc = { hash }
  new Function('document', 'addEventListener', 'location', 'innerHeight', script)({
    querySelectorAll: s => (s === 'nav.toc a' ? links : s === 'details.fold' ? folds : []),
    querySelector: s => (s === 'button.all' && html.includes('class=all') ? B : null),
    getElementById: id => (ids.includes(id) ? sectionEl(id) : null),
  }, (t, f) => { win[t] = f }, loc, 1000)
  return { B, folds, secs, links, win, loc }
}

test('life events run in date order between births and deaths; undated ones come last among them', () => {
  const r = new Renderer({})
  const html = r.eventsHtml({ events: [
    { tag: 'DEAT', val: '', date: '1960' },
    { tag: 'OCCU', val: 'Weaver' },
    { tag: 'RESI', val: '', date: 'FROM 1940 TO 1950' },
    { tag: 'EVEN', val: 'Enlisted', type: 'Military', date: '1918' },
    { tag: 'RESI', val: '', date: '1920' },
    { tag: 'BIRT', val: '', date: '1890' },
    { tag: 'EMIG', val: '', date: 'ABT 1920' },
  ] })
  assert.deepEqual(html.split('</div>').filter(Boolean).map(d => d.replace(/<[^>]+>/g, '')), [
    'Born 1890', 'Military Enlisted &middot; 1918', 'Residence 1920', 'Emigrated about 1920',
    'Residence 1940 – 1950', 'Occupation Weaver', 'Died 1960',
  ])
})
