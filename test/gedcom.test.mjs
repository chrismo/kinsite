import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseGedcom } from '../lib/gedcom.mjs'

const GED = `0 HEAD
1 CHAR UTF-8
0 @U1@ SUBM
1 NAME Not A Person
0 @I1@ INDI
1 NAME Osric Penhallow /Quill/
1 NAME Second /Name/
1 SEX M
1 BIRT
2 DATE 4 JUL 1890
2 PLAC Marrowby, Tansy Shire, QX,
2 NOTE birth note is not a person note
3 CONT ignored
1 DEAT
2 DATE 1960
1 BURI
2 DATE 1961
2 PLAC Not a death place
1 FAMS @F1@
1 FAMC @F2@
1 NOTE First line
2 CONT @@ starts the second line, mid@@line stays
1 NOTE
2 CONT
0 @I2@ INDI
1 NAME Wenna  /Rook/
1 SEX F
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I3@
1 MARR
2 DATE 1915
2 PLAC Marrowby
1 DIV
2 DATE 1920
0 TRLR
`

test('parses individuals and families, skipping other records', () => {
  const { indi, fam } = parseGedcom(GED)
  assert.deepEqual([...indi.keys()], ['I1', 'I2'])
  assert.deepEqual([...fam.keys()], ['F1'])
})

test('first NAME wins; surname and given split on slashes', () => {
  const p = parseGedcom(GED).indi.get('I1')
  assert.equal(p.name, 'Osric Penhallow Quill')
  assert.equal(p.surn, 'Quill')
  assert.equal(p.giv, 'Osric Penhallow')
  const w = parseGedcom(GED).indi.get('I2')
  assert.equal(w.name, 'Wenna  Rook')
  assert.equal(w.giv, 'Wenna')
})

test('birth and death keep DATE/PLAC; a burial place is not a death place', () => {
  const p = parseGedcom(GED).indi.get('I1')
  assert.deepEqual(p.birt, { tag: 'BIRT', val: '', date: '4 JUL 1890', plac: 'Marrowby, Tansy Shire, QX,' })
  assert.deepEqual(p.deat, { tag: 'DEAT', val: '', date: '1960' })
  assert.equal(p.sex, 'M')
})

test('family links strip the @ delimiters', () => {
  const p = parseGedcom(GED).indi.get('I1')
  assert.equal(p.famc, 'F2')
  assert.deepEqual(p.fams, ['F1'])
  assert.deepEqual(parseGedcom(GED).fam.get('F1'), {
    id: 'F1', husb: 'I1', wife: 'I2', chil: ['I3'], marr: { date: '1915', plac: 'Marrowby' },
  })
})

test('person notes join CONT and unescape a leading @@; event notes are not person notes', () => {
  assert.deepEqual(parseGedcom(GED).indi.get('I1').notes,
    ['First line\n@ starts the second line, mid@@line stays', '\n'])
})

test('CRLF and lone CR line endings parse like LF', () => {
  const { indi } = parseGedcom(GED.replace(/\n/g, '\r\n'))
  assert.equal(indi.get('I1').name, 'Osric Penhallow Quill')
  assert.equal(parseGedcom(GED.replace(/\n/g, '\r')).indi.get('I2').sex, 'F')
})

const GED7 = `0 HEAD
1 GEDC
2 VERS 7.0
0 @I1@ INDI
1 NAME Tamsin /Vale/
1 BIRT
2 DATE 17 FEB 2058
3 PHRASE day smudged
1 DEAT
2 DATE
3 PHRASE about 1960
1 OBJE @O1@
2 _PRIM Y
1 OBJE @O9@
0 @I2@ INDI
1 OBJE @O1@
0 @I3@ INDI
1 RESI Rooms above the bakery
2 DATE 1900
2 ADDR 12 Lantern Ln.
2 PHON 555-555-0123
2 EMAIL tamsin@example.com
1 DEAT Y
1 EVEN Blue ribbon
2 TYPE Harvest show
1 BURI
2 PLAC Saltmere churchyard
2 NOTE not a person note
1 CHR
2 RESN CONFIDENTIAL, LOCKED
2 PLAC Kettleby, QX
1 SOUR @S1@
2 PAGE not an event
0 @O1@ OBJE
1 FILE media/tamsin.jpeg
2 FORM image/jpeg
3 MEDI PHOTO
2 TITL Tamsin in 1917
1 NOTE object note
2 CONT not a person note
0 @F1@ FAM
1 MARR
2 DATE
3 PHRASE before the war
2 RESN PRIVACY
0 TRLR
`

test('7.0 OBJE pointers resolve to top-level OBJE records; dangling ones are dropped', () => {
  const { indi } = parseGedcom(GED7)
  const photo = { file: 'media/tamsin.jpeg', title: 'Tamsin in 1917', form: 'image/jpeg' }
  assert.deepEqual(indi.get('I1').media, [photo])
  assert.deepEqual(indi.get('I2').media, [photo])
  assert.deepEqual(indi.get('I1').notes, [])
})

test('7.0 DATE PHRASE is kept, with or without a date value', () => {
  const { indi, fam } = parseGedcom(GED7)
  assert.deepEqual(indi.get('I1').birt, { tag: 'BIRT', val: '', date: '17 FEB 2058', phrase: 'day smudged' })
  assert.deepEqual(indi.get('I1').deat, { tag: 'DEAT', val: '', date: '', phrase: 'about 1960' })
  assert.deepEqual(fam.get('F1').marr, { date: '', phrase: 'before the war', resn: 'PRIVACY' })
})

test('events keep payload, TYPE, DATE and PLAC in file order; contact fields are never read', () => {
  const p = parseGedcom(GED7).indi.get('I3')
  assert.deepEqual(p.events, [
    { tag: 'RESI', val: 'Rooms above the bakery', date: '1900' },
    { tag: 'DEAT', val: 'Y' },
    { tag: 'EVEN', val: 'Blue ribbon', type: 'Harvest show' },
    { tag: 'BURI', val: '', plac: 'Saltmere churchyard' },
    { tag: 'CHR', val: '', resn: 'CONFIDENTIAL, LOCKED', plac: 'Kettleby, QX' },
  ])
  assert.equal(p.deat, p.events[1])
  assert.deepEqual(p.birt, {})
  assert.deepEqual(p.notes, [])
})
