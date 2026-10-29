import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { isLiving, anonymize } from '../lib/living.mjs'
import { buildSite } from '../lib/build.mjs'

const p = (birt, deat = {}) => ({ birt, deat })

test('living: no DEAT, and born within the last 100 years or no birth date', () => {
  assert.equal(isLiving(p({ date: '4 MAY 1990' }), 2026), true)
  assert.equal(isLiving(p({ date: '1926' }), 2026), true, 'exactly 100 years ago')
  assert.equal(isLiving(p({ date: '1925' }), 2026), false)
  assert.equal(isLiving(p({ date: 'ABT 1890' }), 2026), false)
  assert.equal(isLiving(p({ date: '2061' }), 2026), true, 'born in the future')
  assert.equal(isLiving(p({}), 2026), true, 'no birth event')
  assert.equal(isLiving(p({ tag: 'BIRT' }), 2026), true, 'birth without a date')
  assert.equal(isLiving(p({ date: '', phrase: 'the winter of the flood' }), 2026), true, 'phrase only')
  assert.equal(isLiving(p({ date: 'ABT 190' }), 2026), true, 'no four-digit year')
  assert.equal(isLiving(p({ date: 'BET 1920 AND 1930' }), 2026), true, 'a range counts from its latest year')
  assert.equal(isLiving(p({ date: '1990', resn: 'PRIVACY' }), 2026), true)
  assert.equal(isLiving(p({ date: '1990' }, { tag: 'DEAT' }), 2026), false, 'DEAT with no date')
  assert.equal(isLiving(p({}, { tag: 'DEAT', resn: 'PRIVACY' }), 2026), false)
  assert.equal(isLiving(p({ date: String(new Date().getFullYear() - 100) })), true, 'defaults to this year')
  assert.equal(isLiving(p({ date: String(new Date().getFullYear() - 101) })), false)
})

test('anonymize swaps living people for Private stubs, keeps relationships, and drops their marriages', () => {
  const indi = new Map([
    ['I1', { id: 'I1', name: 'Old Zed', birt: { date: '1850' }, deat: { tag: 'DEAT' }, famc: null, fams: ['F1'], media: [], notes: [] }],
    ['I2', { id: 'I2', name: 'New Zed', surn: 'Zed', giv: 'New', sex: 'M', birt: { date: '2060' }, deat: {},
      events: [{ tag: 'OCCU', val: 'Tinker' }], famc: 'F1', fams: ['F2'], media: [{ file: 'n.png' }], notes: ['hi'] }],
  ])
  const fam = new Map([
    ['F1', { id: 'F1', husb: 'I1', wife: null, chil: ['I2'], marr: { date: '1870' } }],
    ['F2', { id: 'F2', husb: 'I2', wife: null, chil: [], marr: { date: '2080', plac: 'Glimmerholt' } }],
  ])
  const a = anonymize(indi, fam, 2026)
  assert.equal(a.indi.get('I1'), indi.get('I1'))
  assert.deepEqual(a.indi.get('I2'), {
    id: 'I2', name: 'Private', surn: '', giv: '', sex: '', private: true,
    birt: {}, deat: {}, events: [], famc: 'F1', fams: ['F2'], media: [], notes: [], sources: [],
  })
  assert.equal(a.fam.get('F1'), fam.get('F1'))
  assert.deepEqual(a.fam.get('F2'), { id: 'F2', husb: 'I2', wife: null, chil: [], marr: {} })
  assert.equal(indi.get('I2').name, 'New Zed', 'input is not mutated')
  assert.deepEqual(fam.get('F2').marr.plac, 'Glimmerholt')
})

test('anonymize withholds media shared with a living person from everyone', () => {
  const shared = { file: 'picnic.jpg', title: 'Wren and Old Zed' }, own = { file: 'zed.jpg', title: '' }
  const indi = new Map([
    ['I1', { id: 'I1', name: 'Old Zed', birt: { date: '1850' }, deat: { tag: 'DEAT' }, fams: ['F1'], media: [shared, own], notes: [] }],
    ['I2', { id: 'I2', name: 'Wren Zed', birt: { date: '2060' }, deat: {}, famc: 'F1', fams: [], media: [{ ...shared }], notes: [] }],
  ])
  const a = anonymize(indi, new Map(), 2026)
  assert.deepEqual(a.indi.get('I1').media, [own])
  assert.deepEqual(a.indi.get('I2').media, [])
  assert.equal(indi.get('I1').media.length, 2, 'input is not mutated')
})

const GED = `0 HEAD
1 GEDC
2 VERS 7.0
0 @I1@ INDI
1 NAME Hollis /Fernwhistle/
1 SEX M
1 BIRT
2 DATE 2 APR 1840
2 PLAC Old Sorrel, Vane Shire
1 DEAT
2 DATE 9 DEC 1911
1 FAMS @F1@
1 OBJE @O2@
0 @I2@ INDI
1 NAME Marigold Juniper /Fernwhistle/
1 SEX F
1 BIRT
2 DATE 17 JUN 2063
2 PLAC Glimmerholt, Vane Shire
2 NOTE Born during the lantern festival.
2 SOUR @S1@
3 PAGE Entry 88
3 DATA
4 TEXT Marigold, a daughter
3 NOTE Midwife's hand
1 OCCU Lamplighter of Brackenmoor
1 RESI
2 DATE FROM 2081 TO 2090
2 PLAC Thimbleford Quay, Vane Shire
1 NOTE Keeps silver-backed bees behind the mill.
2 CONT Ring 555-0142 if a swarm is found.
1 OBJE @O1@
1 OBJE @O2@
1 FAMC @F1@
1 FAMS @F2@
1 SOUR @S1@
2 PAGE Entry 91
0 @I3@ INDI
1 NAME Tobiah /Quenby/
1 SEX M
1 FAMS @F2@
0 @F1@ FAM
1 HUSB @I1@
1 CHIL @I2@
0 @F2@ FAM
1 HUSB @I3@
1 WIFE @I2@
1 MARR
2 DATE 5 SEP 2085
2 PLAC Saint Larkspur chapel, Brackenmoor
0 @O1@ OBJE
1 FILE marigold-at-the-mill.png
2 FORM image/png
2 TITL Juniper at the mill
0 @O2@ OBJE
1 FILE orchard-picnic.png
2 FORM image/png
2 TITL Hollis with Juniper Wrenna in the orchard
0 @S1@ SOUR
1 TITL Thistledown birth roll
0 TRLR
`
const SECRETS = ['Marigold', 'marigold', 'Juniper', 'Female', '17 JUN 2063', '2063', 'Glimmerholt', 'Lamplighter',
  'Brackenmoor', 'Thimbleford', '2081', '2090', 'silver-backed bees', 'swarm', '555-0142',
  'marigold-at-the-mill.png', 'orchard-picnic', 'Wrenna', '5 SEP 2085', '2085', 'Larkspur', 'Tobiah', 'Quenby',
  'lantern festival', 'Thistledown', 'Entry 88', 'a daughter', 'Midwife', 'Entry 91']

function build(anonymizeLiving) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kinsite-living-'))
  const src = path.join(dir, 'src'), out = path.join(dir, 'site')
  fs.mkdirSync(src)
  fs.writeFileSync(path.join(src, 'tree.ged'), GED)
  fs.writeFileSync(path.join(src, 'marigold-at-the-mill.png'), 'not really a png')
  fs.writeFileSync(path.join(src, 'orchard-picnic.png'), 'not really a png')
  buildSite({ gedcom: path.join(src, 'tree.ged'), out, mediaRoot: src, title: 'Fernwhistle', focus: 'I1', anonymizeLiving },
    { log: () => {} })
  const files = fs.readdirSync(out, { recursive: true }).sort()
  const text = files.filter(f => fs.statSync(path.join(out, f)).isFile())
    .map(f => `${f}\n${fs.readFileSync(path.join(out, f), 'latin1')}`).join('\n')
  fs.rmSync(dir, { recursive: true })
  return { files, text }
}

test('with anonymizeLiving, no output file holds a living person\'s name, dates, places, notes or media', () => {
  const plain = build(false)
  for (const s of ['Marigold', '17 JUN 2063', 'Glimmerholt', 'silver-backed bees', 'marigold-at-the-mill.png', 'orchard-picnic.png', 'Wrenna', 'Tobiah', '5 SEP 2085',
    'lantern festival', 'Thistledown', 'Entry 88', 'a daughter', 'Midwife', 'Entry 91'])
    assert.ok(plain.text.includes(s), `control build shows ${s}`)

  const { files, text } = build(true)
  assert.ok(files.includes('I2.html') && files.includes('I3.html'), 'living people keep their pages')
  assert.ok(!files.some(f => f.includes('marigold') || f.includes('orchard')), 'media not copied')
  for (const s of SECRETS) assert.ok(!text.includes(s), `leaked ${s}`)
  assert.match(text, /Hollis Fernwhistle/)
  assert.match(text, /<a href="I2\.html">Private<\/a>/)
})
