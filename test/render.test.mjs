import { test } from 'node:test'
import assert from 'node:assert/strict'
import { esc, yr, life, when, Renderer } from '../lib/render.mjs'
import { Kin } from '../lib/kin.mjs'

test('esc matches Python html.escape', () => {
  assert.equal(esc(`<a href="x">Salt & Pepper's</a>`),
    '&lt;a href=&quot;x&quot;&gt;Salt &amp; Pepper&#x27;s&lt;/a&gt;')
  assert.equal(esc(null), '')
  assert.equal(esc(undefined), '')
})

test('yr takes the first four-digit run', () => {
  assert.equal(yr('BET 3 SEP 2061 AND 9 OCT 2062'), '2061')
  assert.equal(yr('ABT 190'), '')
  assert.equal(yr(undefined), '')
})

test('life joins birth and death years', () => {
  assert.equal(life({ birt: { date: '1890' }, deat: { date: '4 MAR 1960' } }), '1890–1960')
  assert.equal(life({ birt: {}, deat: { date: '1960' } }), '–1960')
  assert.equal(life({ birt: {}, deat: {} }), '')
  assert.equal(life({ birt: { date: '1890', resn: 'PRIVACY' }, deat: { date: '1960' } }), '–1960')
})

test('when shows the date, its phrase in parentheses, or the phrase alone', () => {
  assert.equal(when({ date: '17 FEB 2058', phrase: 'day smudged' }), '17 FEB 2058 (day smudged)')
  assert.equal(when({ date: '', phrase: 'about 1960' }), 'about 1960')
  assert.equal(when({ date: '1960' }), '1960')
  assert.equal(when({}), '')
})

test('when spells out GEDCOM ranges and qualifiers', () => {
  assert.equal(when({ date: 'BET 2071 AND 2072', phrase: '2071/72' }), '2071 – 2072')
  assert.equal(when({ date: 'BET 2083 AND 2084', phrase: '2083/4' }), '2083 – 2084')
  assert.equal(when({ date: 'FEB 2089', phrase: 'FEB 2088/89' }), 'FEB 2089 (FEB 2088/89)')
  assert.equal(when({ date: '', phrase: '2077/78' }), '2077/78')
  assert.equal(when({ date: 'BET 3 SEP 2061 AND 9 SEP 2061' }), '3 SEP 2061 – 9 SEP 2061')
  assert.equal(when({ date: 'FROM 2052 TO 2069' }), '2052 – 2069')
  assert.equal(when({ date: 'FROM 2066', phrase: 'still ongoing' }), 'from 2066 (still ongoing)')
  assert.equal(when({ date: 'TO 1950' }), 'to 1950')
  assert.equal(when({ date: 'ABT 1890' }), 'about 1890')
  assert.equal(when({ date: 'BEF 1900' }), 'before 1900')
  assert.equal(when({ date: 'AFT 1900' }), 'after 1900')
  assert.equal(when({ date: 'CAL 1850' }), 'calculated 1850')
  assert.equal(when({ date: 'EST 1850' }), 'estimated 1850')
  assert.equal(when({ date: '6 JUN 2047' }), '6 JUN 2047')
})

test('eventsHtml orders birth, baptism, other events, then death and burial; an EVEN of type Living reads Residence', () => {
  const r = new Renderer({})
  const html = r.eventsHtml({ events: [
    { tag: 'BURI', val: '', plac: 'Saltmere churchyard' },
    { tag: 'RESI', val: 'Rooms above the bakery', date: '1900' },
    { tag: 'DEAT', val: 'Y' },
    { tag: 'EVEN', val: 'Blue ribbon', type: 'Harvest show' },
    { tag: 'EVEN', val: '', type: 'Living', date: '1970' },
    { tag: 'CHR', val: '', date: '1891' },
    { tag: 'BIRT', val: '', date: '1890', plac: 'Marrowby, QX, ' },
    { tag: 'OCCU', val: 'Wheelwright' },
    { tag: 'EMIG', val: '', date: '1880' },
  ] })
  const lines = html.split('</div>').filter(Boolean).map(d => d.replace(/<[^>]+>/g, ''))
  assert.deepEqual(lines, [
    'Born 1890 &middot; Marrowby, QX',
    'Christened 1891',
    'Residence Rooms above the bakery &middot; 1900',
    'Harvest show Blue ribbon',
    'Residence 1970',
    'Occupation Wheelwright',
    'Emigrated 1880',
    'Died date unknown',
    'Buried Saltmere churchyard',
  ])
})

test('evtHtml filters street addresses from places and contact details from payloads', () => {
  const r = new Renderer({})
  const text = e => r.evtHtml('Residence', e).replace(/<[^>]+>/g, '')
  assert.equal(text({ tag: 'RESI', val: '', plac: '12 Lantern Ave, Marrowby, QX' }), 'Residence Marrowby, QX')
  assert.equal(text({ tag: 'RESI', val: 'call 555-555-0142' }), 'Residence call [phone]')
})

test('events and marriages restricted with RESN PRIVACY or CONFIDENTIAL are not shown', () => {
  const r = new Renderer({})
  assert.equal(r.eventsHtml({ events: [
    { tag: 'OCCU', val: 'Ferryman', resn: 'CONFIDENTIAL, LOCKED' },
    { tag: 'BURI', val: '', resn: 'PRIVACY', plac: 'Quietbrook' },
    { tag: 'DEAT', val: '', resn: 'LOCKED', date: '1960' },
    { tag: 'CHR', val: '', resn: 'privacy', date: '1891' },
    { tag: 'EVEN', val: '', resn: 'NOTPRIVACY', date: '1900' },
  ] }).replace(/<[^>]+>/g, ''), 'Event 1900Died 1960')
  assert.equal(when({ resn: 'PRIVACY', date: '1915' }), '1915')
  assert.equal(r.marriageHtml({ resn: 'PRIVACY', date: '1915', plac: 'Marrowby' }), '')
  assert.equal(r.marriageHtml({ date: '1915', plac: 'Marrowby' }), ' <span class=yr>(m. 1915 Marrowby)</span>')
})

test('a place or payload of just "?" is hidden; a birth or death with nothing to show reads date unknown, other events are dropped', () => {
  const r = new Renderer({})
  const text = (label, e) => r.evtHtml(label, e).replace(/<[^>]+>/g, '')
  assert.equal(text('Died', { tag: 'DEAT', val: '', plac: '?' }), 'Died date unknown')
  assert.equal(text('Born', { tag: 'BIRT', val: '', date: '1890', plac: ' ? ' }), 'Born 1890')
  assert.equal(text('Born', { tag: 'BIRT', val: '' }), 'Born date unknown')
  assert.equal(text('Buried', { tag: 'BURI', val: '' }), '')
  assert.equal(text('Residence', { tag: 'RESI', val: '?' }), '')
  assert.equal(text('Died', { tag: 'DEAT', val: '', plac: 'Tansy Shire, Westmarch ?' }), 'Died Tansy Shire, Westmarch ?')
  assert.equal(r.marriageHtml({ plac: '?' }), '')
  assert.equal(r.marriageHtml({ date: '1910', plac: '?' }), ' <span class=yr>(m. 1910)</span>')
})

const person = (id, giv, date, famc = null, fams = []) => [id, {
  id, giv, surn: 'Zed', name: `${giv} Zed`, sex: '', famc, fams,
  birt: date ? { date } : {}, deat: {}, events: [], media: [], notes: [],
}]

test('personPage lists siblings, children and descendants by birth year, undated last', () => {
  const indi = new Map([
    person('I1', 'Ash', '1950', 'F1', ['F2']), person('I2', 'Bay', '1960', 'F1'),
    person('I3', 'Cal', 'ABT 1940', 'F1'), person('I4', 'Dee', '', 'F1'),
    person('I5', 'Eli', '1980', 'F2', ['F3']), person('I6', 'Fen', '1975', 'F2'),
    person('I8', 'Gus', '2005', 'F3'), person('I9', 'Hal', '2001', 'F3'),
  ])
  const fam = new Map([
    ['F1', { id: 'F1', husb: null, wife: null, chil: ['I2', 'I1', 'I4', 'I3'], marr: {} }],
    ['F2', { id: 'F2', husb: 'I1', wife: null, chil: ['I5', 'I6'], marr: {} }],
    ['F3', { id: 'F3', husb: 'I5', wife: null, chil: ['I8', 'I9'], marr: {} }],
  ])
  const kin = new Kin(indi, fam, 'I1')
  const { html } = new Renderer({ indi, fam, kin, copied: new Map() }).personPage('I1')
  const names = section => html.split(section)[1].split('<h2>')[0].match(/>[A-Z][a-z]+ Zed</g).map(s => s.slice(1, -1))
  assert.deepEqual(names('<h2>Siblings</h2>'), ['Cal Zed', 'Bay Zed', 'Dee Zed'])
  assert.deepEqual(names('<h2>Spouse &amp; children</h2>'), ['Fen Zed', 'Eli Zed'])
  assert.deepEqual(names('<h2>Descendants</h2>'), ['Fen Zed', 'Eli Zed', 'Hal Zed', 'Gus Zed'])
})

test('indexPage marks people with photos and offers a photos-only filter', () => {
  const p = (id, giv, media = []) => ({ id, giv, surn: 'Thistle', name: `${giv} Thistle`, media, birt: {}, deat: {} })
  const indi = new Map([
    ['I1', p('I1', 'Ada', [{ file: 'a.jpg', title: 'Ada' }])],
    ['I2', p('I2', 'Bram', [{ file: 'lost.jpg', title: 'Bram' }])],
    ['I3', p('I3', 'Cy', [{ file: 'cy.pdf', title: 'letter' }])],
  ])
  const copied = new Map([['a.jpg', 'media/a.jpg'], ['cy.pdf', 'media/cy.pdf']])
  const kin = { primary: null, parentsOf: () => [null, null] }
  const html = new Renderer({ indi, fam: new Map(), kin, copied }).indexPage()
  const items = html.match(/<li [^]*?<\/li>/g)
  assert.match(items[0], /data-photo/)
  assert.match(items[0], /class=cam/)
  for (const li of items.slice(1)) assert.doesNotMatch(li, /data-photo|class=cam/)
  assert.match(html, /1 with photos/)
  assert.match(html, /<input type=checkbox id=photos>/)
})

test('title and source come from the caller; neither is baked in', () => {
  const indi = new Map([person('I1', 'Ash', '1950')])
  const kin = new Kin(indi, new Map(), 'I1')
  const r = new Renderer({ indi, fam: new Map(), kin, copied: new Map(), title: 'The Zed Family', source: 'zed.ged' })
  const index = r.indexPage()
  assert.match(index, /<title>The Zed Family<\/title>/)
  assert.match(index, /<h1>The Zed Family<\/h1>/)
  assert.match(index, /<footer>Generated from <code>zed\.ged<\/code> by kinsite /)
  assert.match(r.personPage('I1').html, /<code>zed\.ged<\/code>/)

  const bare = new Renderer({ indi, fam: new Map(), kin, copied: new Map() }).indexPage()
  assert.match(bare, /<h1>Family Tree<\/h1>/)
  assert.match(bare, /<footer>Generated by kinsite /)
})

test('escapes a title and source that contain markup', () => {
  const indi = new Map([person('I1', 'Ash', '1950')])
  const kin = new Kin(indi, new Map(), 'I1')
  const html = new Renderer({ indi, fam: new Map(), kin, copied: new Map(), title: 'A & <B>', source: '<x>.ged' }).indexPage()
  assert.match(html, /<h1>A &amp; &lt;B&gt;<\/h1>/)
  assert.match(html, /<code>&lt;x&gt;\.ged<\/code>/)
})

const sortedIndex = () => {
  const p = (id, giv, date, resn) => ({ id, giv, surn: 'Thistle', name: `${giv} Thistle`, media: [], birt: { date, resn }, deat: {} })
  const indi = new Map([
    ['I1', p('I1', 'Ada', '1900')],
    ['I2', p('I2', 'Bram', undefined)],
    ['I3', p('I3', 'Cy', 'ABT 1850')],
    ['I4', p('I4', 'Dot', 'ABT 190')],
    ['I5', p('I5', 'Eli', '1900')],
    ['I6', p('I6', 'Fay', '1800', 'PRIVACY')],
  ])
  const kin = { primary: null, parentsOf: () => [null, null] }
  return new Renderer({ indi, fam: new Map(), kin, copied: new Map() }).indexPage()
}
const given = li => li.match(/Thistle, (\w+)</)[1]

test('indexPage lists people A-Z by default, with birth years and a JS-only sort button', () => {
  const html = sortedIndex()
  const items = html.match(/<li [^]*?<\/li>/g)
  assert.deepEqual(items.map(given), ['Ada', 'Bram', 'Cy', 'Dot', 'Eli', 'Fay'])
  assert.match(items[2], /^<li data-n="cy thistle" data-b=1850>/)
  for (const i of [1, 3, 5]) assert.doesNotMatch(items[i], /data-b/)
  assert.match(html, /<button type=button id=sort hidden>A–Z<\/button>/)
})

test('the sort button cycles A-Z, oldest first, newest first, undated always last', () => {
  const html = sortedIndex()
  const el = (attrs = {}, text = '') => ({ attrs, textContent: text, hidden: true, style: {}, handlers: {}, children: [],
    getAttribute: k => attrs[k] ?? null, hasAttribute: k => k in attrs,
    addEventListener(t, fn) { this.handlers[t] = fn } })
  const list = el()
  list.appendChild = e => { const i = list.children.indexOf(e); if (i > -1) list.children.splice(i, 1); list.children.push(e) }
  list.children = html.match(/<li [^]*?<\/li>/g).map(li => {
    const attrs = { 'data-n': li.match(/data-n="([^"]*)"/)[1] }
    const b = li.match(/data-b=(\d+)/)
    if (b) attrs['data-b'] = b[1]
    return Object.assign(el(attrs), { name: given(li) })
  })
  const byId = { q: Object.assign(el(), { value: '' }), photos: Object.assign(el(), { checked: false }), list, sort: el({}, 'A–Z') }
  new Function('document', html.match(/<script>([^]*?)<\/script>/)[1])({ getElementById: id => byId[id] })
  const order = () => list.children.map(e => e.name).join(' ')
  const click = () => byId.sort.handlers.click()
  assert.equal(byId.sort.hidden, false)
  assert.equal(order(), 'Ada Bram Cy Dot Eli Fay')
  click()
  assert.equal(byId.sort.textContent, 'Oldest first')
  assert.equal(order(), 'Cy Ada Eli Bram Dot Fay')
  click()
  assert.equal(byId.sort.textContent, 'Newest first')
  assert.equal(order(), 'Ada Eli Cy Bram Dot Fay')
  click()
  assert.equal(byId.sort.textContent, 'A–Z')
  assert.equal(order(), 'Ada Bram Cy Dot Eli Fay')
})
