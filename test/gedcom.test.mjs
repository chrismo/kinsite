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
2 NOTE birth note stays with the birth
3 CONT and its continuation
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
  assert.deepEqual(p.birt, { tag: 'BIRT', val: '', date: '4 JUL 1890', plac: 'Marrowby, Tansy Shire, QX,',
    notes: ['birth note stays with the birth\nand its continuation'] })
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
    { tag: 'BURI', val: '', plac: 'Saltmere churchyard', notes: ['not a person note'] },
    { tag: 'CHR', val: '', resn: 'CONFIDENTIAL, LOCKED', plac: 'Kettleby, QX' },
  ])
  assert.equal(p.deat, p.events[1])
  assert.deepEqual(p.birt, {})
  assert.deepEqual(p.notes, [])
})

const EVIDENCE = `0 HEAD
1 GEDC
2 VERS 7.0
0 @I1@ INDI
1 NAME Abner /Quill/
2 SOUR @S2@
3 PAGE Baptism roll
1 NAME Ab /Quill/
2 SOUR @S1@
1 DEAT
2 DATE 3 MAR 1901
2 PLAC Fernhollow, Wexmoor
2 NOTE The family Bible says March;
3 CONT the stone may have been recut.
2 SOUR @S1@
3 PAGE p. 12
4 CONT top margin
3 DATA
4 DATE 1901
4 TEXT Abner Quill,
5 CONT d. 3rd March 1901
3 NOTE Ink faded.
1 DEAT
2 DATE 1902
2 PLAC Fernhollow Churchyard, Wexmoor
2 SOUR @S2@
3 PAGE Plot 14
1 SOUR @S3@
1 SOUR @VOID@
2 PAGE Told by a cousin
1 SOUR @S9@
1 SOUR Told by Aunt Wenna
2 CONT at the fair
1 NOTE Person note
1 NOTE @N1@
1 BURI
2 NOTE @N1@
2 SOUR @S1@
3 NOTE @N2@
3 DATA
4 TEXT Laid to rest
4 TEXT beside Briony
0 @N1@ NOTE Shared notes are not read
0 @S1@ SOUR
1 TITL Quill family Bible
1 AUTH not read
0 @S2@ SOUR
1 TITL Fernhollow churchyard
2 CONT survey
0 @S3@ SOUR
1 NOTE no title
0 TRLR
`

const cite = (title, page = '', text = '', notes = []) => ({ title, page, text, notes })

test('event notes and citations stay with their event; the first of repeated events is the preferred one', () => {
  const p = parseGedcom(EVIDENCE).indi.get('I1')
  assert.deepEqual(p.events.slice(0, 2), [
    { tag: 'DEAT', val: '', date: '3 MAR 1901', plac: 'Fernhollow, Wexmoor',
      notes: ['The family Bible says March;\nthe stone may have been recut.'],
      sources: [cite('Quill family Bible', 'p. 12\ntop margin', 'Abner Quill,\nd. 3rd March 1901', ['Ink faded.'])] },
    { tag: 'DEAT', val: '', date: '1902', plac: 'Fernhollow Churchyard, Wexmoor',
      sources: [cite('Fernhollow churchyard\nsurvey', 'Plot 14')] },
  ])
  assert.equal(p.deat, p.events[0])
  assert.deepEqual(p.notes, ['Person note'])
})

test('birth and death summaries come from the first version with a date', () => {
  const { indi } = parseGedcom(`0 @I1@ INDI
1 BIRT
2 PLAC Marrowby
1 BIRT
2 DATE 1841
1 DEAT Y
1 DEAT
2 DATE
3 PHRASE the hard winter
0 @I2@ INDI
1 DEAT Y
1 DEAT Y
0 @I3@ INDI
1 BIRT
2 DATE 1841
2 RESN PRIVACY
1 BIRT
2 DATE 1842
`)
  const [a, b, c] = [indi.get('I1'), indi.get('I2'), indi.get('I3')]
  assert.equal(a.birt, a.events[1])
  assert.equal(a.deat, a.events[3])
  assert.equal(b.deat, b.events[0])
  assert.equal(c.birt, c.events[1], 'a restricted version is passed over')
})

test('a NOTE that points to a shared note record is skipped, not shown as its pointer', () => {
  const p = parseGedcom(EVIDENCE).indi.get('I1')
  assert.deepEqual(p.events[2], { tag: 'BURI', val: '', sources: [cite('Quill family Bible', '', 'Laid to rest\nbeside Briony')] })
  assert.deepEqual(parseGedcom('0 @I1@ INDI\n1 NOTE @@N1@ is how a note starts with an at sign\n').indi.get('I1').notes,
    ['@N1@ is how a note starts with an at sign'])
})

test('citations on the person and on the shown name are person sources; dangling and void ones keep their page', () => {
  assert.deepEqual(parseGedcom(EVIDENCE).indi.get('I1').sources, [
    cite('Fernhollow churchyard\nsurvey', 'Baptism roll'),
    cite(''),
    cite('', 'Told by a cousin'),
    cite(''),
    cite('Told by Aunt Wenna\nat the fair'),
  ])
  assert.deepEqual(parseGedcom(GED).indi.get('I1').sources, [])
})
