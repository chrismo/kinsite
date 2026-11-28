import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { parseGedcom } from '../lib/gedcom.mjs'
import { diffTrees, describe, formatChanges } from '../lib/diff.mjs'

// Invented. Ada married Jonas Pell; Tobias and Mara are her parents, Silas and Hester her grandparents.
const OLD = `0 @I1@ INDI
1 NAME Ada /Fenwick/
1 SEX F
1 BIRT
2 DATE 1859
2 PLAC Marrowby
1 FAMC @F1@
1 FAMS @F3@
0 @I2@ INDI
1 NAME Tobias /Fenwick/
1 SEX M
1 BIRT
2 DATE 1825
1 DEAT
2 DATE 1890
1 FAMC @F2@
1 FAMS @F1@
0 @I3@ INDI
1 NAME Mara /Quill/
1 SEX F
1 BIRT
2 DATE 1830
1 FAMS @F1@
0 @I4@ INDI
1 NAME Silas /Fenwick/
1 BIRT
2 DATE 1795
1 FAMS @F2@
0 @I5@ INDI
1 NAME Hester /Lowe/
1 BIRT
2 DATE 1798
1 FAMS @F2@
0 @I9@ INDI
1 NAME Jonas /Pell/
1 SEX M
1 BIRT
2 DATE 1855
1 FAMS @F3@
0 @F1@ FAM
1 HUSB @I2@
1 WIFE @I3@
1 CHIL @I1@
0 @F2@ FAM
1 HUSB @I4@
1 WIFE @I5@
1 CHIL @I2@
0 @F3@ FAM
1 HUSB @I9@
1 WIFE @I1@
1 MARR
2 DATE 1880
2 PLAC Marrowby
0 @S1@ SOUR
1 TITL Marrowby parish register
0 TRLR
`
const edit = (ged, ...pairs) => {
  for (let i = 0; i < pairs.length; i += 2) {
    assert.ok(typeof pairs[i] === 'string' ? ged.includes(pairs[i]) : pairs[i].test(ged), `fixture has ${pairs[i]}`)
    ged = ged.replace(pairs[i], pairs[i + 1])
  }
  return ged
}
const adaGets = lines => edit(OLD, '1 FAMC @F1@\n1 FAMS @F3@\n', `1 FAMC @F1@\n1 FAMS @F3@\n${lines}`)
// Born recently, so Private on a public site.
const withWren = ged => edit(ged, '0 @F1@ FAM', `0 @I7@ INDI
1 NAME Wren /Fenwick/
1 SEX F
1 BIRT
2 DATE 1990
1 FAMC @F3@
0 @F1@ FAM`, '1 HUSB @I9@\n1 WIFE @I1@\n', '1 HUSB @I9@\n1 WIFE @I1@\n1 CHIL @I7@\n')

const PUBLIC = { anonymizeLiving: true, citations: false, notes: false }
function changes(oldGed, newGed, config = {}) {
  const cur = parseGedcom(newGed)
  return formatChanges(describe(diffTrees(parseGedcom(oldGed), cur), cur, config, { year: 2026 }))
}

test('the example from the issue: one sentence per change, grouped by person', () => {
  const old = edit(OLD, '1 FAMC @F1@\n1 FAMS', '1 FAMC @F2@\n1 FAMC @F1@\n1 FAMS', '1 CHIL @I2@\n', '1 CHIL @I2@\n1 CHIL @I1@\n')
  const cur = edit(adaGets('1 RESI\n2 DATE 1880\n2 PLAC Marrowby\n'), '2 DATE 1859', '2 DATE ABT 1858',
    /0 @I9@ INDI\n(?:[12] .*\n)*/, '', '1 HUSB @I9@\n', '')
  assert.equal(changes(old, cur), `Ada Fenwick (I1)
  Changed birth date from 1859 to about 1858
  Added: residence 1880, Marrowby
  Now listed as a child of Tobias Fenwick and Mara Quill
Removed: Jonas Pell (I9) and his marriage to Ada Fenwick`)
})

test('no changes, and tags the site does not render, give no lines', () => {
  assert.equal(changes(OLD, OLD), 'No changes.')
  assert.equal(changes(OLD, adaGets('1 _UID 1234\n1 ADDR 12 Lantern Ave\n1 NAME Ada /Pell/\n')), 'No changes.')
  assert.deepEqual(diffTrees(parseGedcom(OLD), parseGedcom(OLD)), [])
})

test('facts: identical versions are unchanged; the rest pair in file order on a shared date or place', () => {
  const old = adaGets('1 RESI\n2 DATE 1880\n2 PLAC Marrowby\n1 RESI\n2 DATE 1890\n2 PLAC Kettleby\n1 BURI\n2 DATE 1902\n2 PLAC Oak Hill\n')
  const cur = adaGets('1 RESI\n2 DATE 1890\n2 PLAC Kettleby\n1 RESI\n2 DATE 1881\n2 PLAC Marrowby\n1 OCCU Weaver\n1 EVEN\n2 TYPE Census\n2 DATE 1880\n')
  assert.equal(changes(old, cur), `Ada Fenwick (I1)
  Changed residence date from 1880 to 1881
  Removed: burial 1902, Oak Hill
  Added: occupation Weaver
  Added: Census 1880`)
  assert.equal(changes(old, cur, PUBLIC), `Ada Fenwick (I1)
  Changed residence date to 1881
  Removed a burial record
  Added: occupation Weaver
  Added: Census 1880`, 'with anonymizeLiving, removals name only the type')
})

test('a fact whose date and place both changed reads as a removal and an addition', () => {
  assert.equal(changes(adaGets('1 BURI\n2 DATE 1902\n2 PLAC Oak Hill\n'), adaGets('1 BURI\n2 DATE 1903\n2 PLAC Elm Hill\n')), `Ada Fenwick (I1)
  Removed: burial 1902, Oak Hill
  Added: burial 1903, Elm Hill`)
  assert.equal(changes(adaGets('1 BURI\n2 DATE 1902\n2 PLAC Oak Hill\n'), adaGets('1 BURI\n2 DATE 1902\n2 PLAC Elm Hill\n')),
    'Ada Fenwick (I1)\n  Changed burial place from Oak Hill to Elm Hill')
})

test('lines follow the new file\'s order of versions', () => {
  const old = adaGets('1 DEAT\n2 DATE ABT 1910\n2 PLAC Marrowby\n1 DEAT\n2 DATE 1911\n2 SOUR @S1@\n3 PAGE f. 1\n')
  const cur = adaGets('1 DEAT\n2 DATE 1910\n2 PLAC Marrowby\n1 DEAT\n2 DATE 1911\n2 SOUR @S1@\n3 PAGE f. 2\n')
  assert.equal(changes(old, cur), `Ada Fenwick (I1)
  Changed death date from about 1910 to 1910
  Removed a citation from the death: Marrowby parish register, f. 1
  Added a citation to the death: Marrowby parish register, f. 2`)
})

test('which version is preferred', () => {
  const old = adaGets('1 BIRT\n2 DATE ABT 1858\n')
  const cur = edit(OLD, '1 BIRT\n2 DATE 1859\n2 PLAC Marrowby\n', '1 BIRT\n2 DATE ABT 1858\n1 BIRT\n2 DATE 1859\n2 PLAC Marrowby\n')
  assert.equal(changes(old, cur), 'Ada Fenwick (I1)\n  Preferred birth is now about 1858, not 1859, Marrowby')
  assert.equal(changes(old, cur, PUBLIC), 'Ada Fenwick (I1)\n  Preferred birth is now about 1858', 'with anonymizeLiving, the old version is not quoted')
  const hidden = edit(OLD, '2 PLAC Marrowby\n1 FAMC', '2 PLAC Marrowby\n2 RESN PRIVACY\n1 BIRT\n2 DATE 1860\n2 PLAC Kettleby\n1 FAMC')
  assert.equal(changes(OLD, hidden), 'Ada Fenwick (I1)\n  Added: birth 1860, Kettleby', 'a version that became restricted is not named')
})

test('RESN: restricted versions never appear, and becoming restricted gives no line', () => {
  const restrict = edit(OLD, '2 DATE 1859\n', '2 DATE 1859\n2 RESN PRIVACY\n')
  assert.equal(changes(OLD, restrict), 'No changes.')
  assert.equal(changes(OLD, adaGets('1 BURI\n2 DATE 1902\n2 RESN confidential\n2 NOTE In the family plot\n')), 'No changes.')
  assert.equal(changes(adaGets('1 BURI\n2 DATE 1902\n2 RESN PRIVACY\n'), OLD), 'No changes.')
  const hiddenBurial = adaGets('1 BURI\n2 DATE 1902\n2 RESN PRIVACY\n')
  assert.equal(changes(hiddenBurial, edit(hiddenBurial, '2 RESN PRIVACY\n', '2 RESN PRIVACY\n2 NOTE Family plot\n2 SOUR @S1@\n')), 'No changes.',
    'notes and citations of a restricted version')
  assert.equal(changes(restrict, OLD), 'Ada Fenwick (I1)\n  Added: birth 1859, Marrowby', 'a lifted restriction shows the version')
  const secret = edit(restrict, '2 RESN PRIVACY\n', '2 RESN CONFIDENTIAL\n2 NOTE Born out of wedlock\n2 SOUR @S1@\n3 PAGE 12\n')
  assert.equal(changes(secret, OLD), 'Ada Fenwick (I1)\n  Added: birth 1859, Marrowby', 'notes and citations of a formerly restricted version')
  assert.equal(changes(secret, OLD, PUBLIC), 'Ada Fenwick (I1)\n  Added: birth 1859, Marrowby')
})

test('names', () => {
  const cur = edit(OLD, '1 NAME Ada /Fenwick/', '1 NAME Ada /Pell/')
  assert.equal(changes(OLD, cur), 'Ada Pell (I1)\n  Changed name from Ada Fenwick to Ada Pell')
  assert.equal(changes(OLD, cur, PUBLIC), 'Ada Pell (I1)\n  Changed name to Ada Pell')
})

test('notes are matched by text; one leaving and one arriving is a change', () => {
  const old = adaGets('1 NOTE Kept the mill\n1 NOTE Sang in the choir\n1 BURI\n2 DATE 1902\n2 NOTE Rain that day\n')
  const changed = adaGets('1 NOTE Sang in the choir\n1 NOTE Kept the mill at Marrowby\n1 BURI\n2 DATE 1902\n')
  assert.equal(changes(old, changed), `Ada Fenwick (I1)
  Removed a note from the burial: “Rain that day”
  Changed a note to “Kept the mill at Marrowby”`)
  assert.equal(changes(old, changed, { anonymizeLiving: true }), `Ada Fenwick (I1)
  Removed a note from the burial
  Changed a note to “Kept the mill at Marrowby”`)
  assert.equal(changes(old, changed, { notes: false }), 'No changes.')
  const two = adaGets('1 NOTE Sang in the choir\n1 NOTE Wove linen\n1 NOTE Kept bees\n1 BURI\n2 DATE 1902\n2 NOTE Rain that day\n')
  assert.equal(changes(old, two), `Ada Fenwick (I1)
  Removed a note: “Kept the mill”
  Added a note: “Wove linen”
  Added a note: “Kept bees”`)
})

test('citations are matched by source and page, so retitling the source changes nothing', () => {
  const old = adaGets('1 SOUR @S1@\n2 PAGE f. 3\n1 SOUR Told by a cousin\n1 BURI\n2 DATE 1902\n2 SOUR @S1@\n3 PAGE f. 9\n')
  assert.equal(changes(old, edit(old, '1 TITL Marrowby parish register', '1 TITL Register of St Ann, Marrowby')), 'No changes.')
  const cur = adaGets('1 SOUR @S1@\n2 PAGE f. 3\n2 DATA\n3 TEXT Ada, daughter of Tobias\n1 BURI\n2 DATE 1902\n2 SOUR @S1@\n3 PAGE f. 10\n')
  assert.equal(changes(old, cur), `Ada Fenwick (I1)
  Removed a citation from the burial: Marrowby parish register, f. 9
  Added a citation to the burial: Marrowby parish register, f. 10
  Changed a citation: Marrowby parish register, f. 3, “Ada, daughter of Tobias”
  Removed a citation: Told by a cousin`)
  assert.equal(changes(old, cur, { anonymizeLiving: true }), `Ada Fenwick (I1)
  Removed a citation from the burial
  Added a citation to the burial: Marrowby parish register, f. 10
  Changed a citation: Marrowby parish register, f. 3, “Ada, daughter of Tobias”
  Removed a citation`)
  assert.equal(changes(old, cur, { citations: false }), 'No changes.')
})

test('photos and documents are keyed by FILE; a living person\'s media and media shared with them never appear', () => {
  const media = `0 @O1@ OBJE
1 FILE ada.jpg
2 TITL Ada at the mill
0 @O2@ OBJE
1 FILE letter.pdf
0 @O3@ OBJE
1 FILE picnic.jpg
2 TITL The picnic
0 TRLR
`
  const old = edit(withWren(OLD), '0 TRLR\n', media)
  const cur = edit(old, '1 FAMC @F1@\n1 FAMS @F3@\n', '1 FAMC @F1@\n1 FAMS @F3@\n1 OBJE @O2@\n1 OBJE @O3@\n',
    '1 FAMC @F3@\n', '1 FAMC @F3@\n1 OBJE @O3@\n')
  assert.equal(changes(old, cur), `Ada Fenwick (I1)
  Added a document: letter.pdf
  Added a photo: The picnic
Wren Fenwick (I7)
  Added a photo: The picnic`)
  assert.equal(changes(old, cur, PUBLIC), 'Ada Fenwick (I1)\n  Added a document: letter.pdf')
  const withPhoto = edit(old, '1 FAMC @F1@\n1 FAMS @F3@\n', '1 FAMC @F1@\n1 FAMS @F3@\n1 OBJE @O1@\n')
  assert.equal(changes(withPhoto, old), 'Ada Fenwick (I1)\n  Removed a photo: Ada at the mill')
  assert.equal(changes(withPhoto, old, PUBLIC), 'Ada Fenwick (I1)\n  Removed a photo')
  assert.equal(changes(withPhoto, edit(withPhoto, '2 TITL Ada at the mill', '2 TITL Ada and the loom')),
    'Ada Fenwick (I1)\n  Retitled a photo from Ada at the mill to Ada and the loom')
})

test('a photo\'s CROP and link TITL are not changes, and records keep only the shared OBJE fields', () => {
  const media = '0 @O3@ OBJE\n1 FILE picnic.jpg\n2 TITL The picnic\n0 TRLR\n'
  const old = edit(OLD, '0 TRLR\n', media, '1 FAMC @F1@\n1 FAMS @F3@\n', '1 FAMC @F1@\n1 FAMS @F3@\n1 OBJE @O3@\n')
  const cropped = edit(old, '1 OBJE @O3@\n', '1 OBJE @O3@\n2 CROP\n3 LEFT 40\n2 TITL On the left\n')
  assert.equal(changes(old, cropped), 'No changes.')
  const added = diffTrees(parseGedcom(OLD), parseGedcom(cropped)).filter(r => r.kind === 'media')
  assert.deepEqual(added.map(r => r.to), [{ file: 'picnic.jpg', title: 'The picnic', form: '' }])
})

test('parent links: a new main family is one line; other links say also, or no longer, with their labels', () => {
  const both = edit(OLD, '1 CHIL @I2@\n', '1 CHIL @I2@\n1 CHIL @I1@\n', '1 FAMC @F1@\n1 FAMS', '1 FAMC @F1@\n1 FAMC @F2@\n1 FAMS')
  assert.equal(changes(OLD, both), 'Ada Fenwick (I1)\n  Now also listed as a child of Silas Fenwick and Hester Lowe')
  assert.equal(changes(both, OLD), 'Ada Fenwick (I1)\n  No longer listed as a child of Silas Fenwick and Hester Lowe')
  const swapped = edit(both, '1 FAMC @F1@\n1 FAMC @F2@\n', '1 FAMC @F2@\n1 FAMC @F1@\n')
  assert.equal(changes(both, swapped), 'Ada Fenwick (I1)\n  Now listed as a child of Silas Fenwick and Hester Lowe')
  const adopted = edit(both, '1 FAMC @F2@\n', '1 FAMC @F2@\n2 PEDI ADOPTED\n2 STAT CHALLENGED\n')
  assert.equal(changes(both, adopted),
    'Ada Fenwick (I1)\n  Relabeled as a child of Silas Fenwick and Hester Lowe from no label to adopted, challenged')
  assert.equal(changes(OLD, adopted),
    'Ada Fenwick (I1)\n  Now also listed as a child of Silas Fenwick and Hester Lowe (adopted, challenged)')
})

test('a DISPROVEN family shows on a research site and counts as absent with anonymizeLiving', () => {
  const both = edit(OLD, '1 CHIL @I2@\n', '1 CHIL @I2@\n1 CHIL @I1@\n', '1 FAMC @F1@\n1 FAMS', '1 FAMC @F1@\n1 FAMC @F2@\n1 FAMS')
  const disproven = edit(both, '1 FAMC @F2@\n', '1 FAMC @F2@\n2 STAT DISPROVEN\n')
  assert.equal(changes(both, disproven),
    'Ada Fenwick (I1)\n  Relabeled as a child of Silas Fenwick and Hester Lowe from no label to disproven')
  assert.equal(changes(both, disproven, PUBLIC), 'Ada Fenwick (I1)\n  No longer listed as a child of Silas Fenwick and Hester Lowe')
  assert.equal(changes(disproven, both, PUBLIC), 'Ada Fenwick (I1)\n  Now also listed as a child of Silas Fenwick and Hester Lowe')
  assert.equal(changes(OLD, disproven, PUBLIC), 'No changes.')
  assert.equal(changes(OLD, disproven), 'Ada Fenwick (I1)\n  Now also listed as a child of Silas Fenwick and Hester Lowe (disproven)')
})

test('marriages: added, removed, and date or place changed', () => {
  const unwed = edit(OLD, '1 HUSB @I9@\n', '', '1 FAMS @F3@\n0 @F1@', '0 @F1@')
  assert.equal(changes(unwed, OLD), 'Ada Fenwick (I1)\n  Added: marriage to Jonas Pell, 1880, Marrowby')
  assert.equal(changes(OLD, unwed), 'Ada Fenwick (I1)\n  Removed: marriage to Jonas Pell, 1880, Marrowby')
  assert.equal(changes(OLD, unwed, PUBLIC), 'Ada Fenwick (I1)\n  Removed a marriage to Jonas Pell')
  assert.equal(changes(OLD, edit(OLD, '2 DATE 1880', '2 DATE 1881')),
    'Ada Fenwick (I1)\n  Changed date of the marriage to Jonas Pell from 1880 to 1881')
  assert.equal(changes(OLD, edit(OLD, '2 PLAC Marrowby', '2 PLAC Marrowby\n2 RESN PRIVACY')), 'No changes.')
  assert.equal(changes(OLD, edit(OLD, '2 DATE 1880\n2 PLAC Marrowby', '2 DATE 1881\n2 PLAC Kettleby')),
    'Ada Fenwick (I1)\n  Changed the marriage to Jonas Pell from 1880, Marrowby to 1881, Kettleby', 'an only marriage is one fact')
})

test('people added and removed, with their marriages and main parents', () => {
  const kit = edit(OLD, '0 @F1@ FAM', `0 @I8@ INDI
1 NAME Kit /Fenwick/
1 SEX M
1 BIRT
2 DATE 1861
1 FAMC @F1@
0 @F1@ FAM`, '1 CHIL @I1@\n', '1 CHIL @I1@\n1 CHIL @I8@\n')
  assert.equal(changes(OLD, kit), 'Added: Kit Fenwick (I8), a child of Tobias Fenwick and Mara Quill')
  assert.equal(changes(kit, OLD), 'Removed: Kit Fenwick (I8)')
  const noPell = edit(OLD, /0 @I9@ INDI\n(?:[12] .*\n)*/, '', '1 HUSB @I9@\n', '')
  assert.equal(changes(noPell, OLD), 'Added: Jonas Pell (I9) and his marriage to Ada Fenwick')
  const kitWed = edit(kit, '1 FAMC @F1@\n0 @F1@', '1 FAMC @F1@\n1 FAMS @F4@\n0 @F1@', '0 TRLR', '0 @F4@ FAM\n1 HUSB @I8@\n1 WIFE @I5@\n0 TRLR',
    '1 FAMS @F2@\n0 @I9@', '1 FAMS @F2@\n1 FAMS @F4@\n0 @I9@')
  assert.equal(changes(OLD, kitWed), 'Added: Kit Fenwick (I8), a child of Tobias Fenwick and Mara Quill, and his marriage to Hester Lowe')
})

test('a family that keeps its xref but changes a spouse reads as one marriage removed and one added', () => {
  const kit = edit(OLD, '0 @F1@ FAM', '0 @I8@ INDI\n1 NAME Kit /Pell/\n1 BIRT\n2 DATE 1851\n0 @F1@ FAM')
  const swapped = edit(kit, '1 HUSB @I9@', '1 HUSB @I8@', '2 DATE 1855\n1 FAMS @F3@\n', '2 DATE 1855\n', '2 DATE 1851\n', '2 DATE 1851\n1 FAMS @F3@\n')
  assert.equal(changes(kit, swapped), `Ada Fenwick (I1)
  Removed: marriage to Jonas Pell, 1880, Marrowby
  Added: marriage to Kit Pell, 1880, Marrowby`)
})

test('privacy: no line about a Private person, or a link with a Private end', () => {
  const old = withWren(OLD)
  const wrenChanges = edit(old, '2 DATE 1990', '2 DATE 1991\n1 NOTE Plays the fiddle\n1 RESI\n2 PLAC Marrowby')
  assert.match(changes(old, wrenChanges), /^Wren Fenwick \(I7\)/)
  assert.equal(changes(old, wrenChanges, PUBLIC), 'No changes.')
  assert.equal(changes(OLD, old, PUBLIC), 'No changes.', 'an added Private person')
  assert.equal(changes(old, OLD, PUBLIC), 'No changes.', 'a removed person whose snapshot is Private')
  assert.equal(changes(old, OLD), 'Removed: Wren Fenwick (I7)')
  const wrenWed = edit(old, '0 @F1@ FAM', '0 @F9@ FAM\n1 HUSB @I2@\n1 WIFE @I7@\n0 @F1@ FAM', '1 FAMC @F3@\n', '1 FAMC @F3@\n1 FAMS @F9@\n',
    '1 FAMS @F1@\n', '1 FAMS @F1@\n1 FAMS @F9@\n')
  assert.match(changes(old, wrenWed), /marriage to Wren Fenwick/)
  assert.equal(changes(old, wrenWed, PUBLIC), 'No changes.')
  const wrenParents = edit(old, '1 FAMC @F3@\n', '1 FAMC @F3@\n1 FAMC @F1@\n', '1 CHIL @I1@\n', '1 CHIL @I1@\n1 CHIL @I7@\n')
  assert.equal(changes(old, wrenParents, PUBLIC), 'No changes.')
  assert.equal(changes(OLD, edit(OLD, '1 DEAT\n2 DATE 1890\n', ''), PUBLIC), 'Tobias Fenwick (I2)\n  Removed a death record')
})

test('all text passes through redact()', () => {
  const cur = adaGets('1 NOTE Write to ada@example.com\n1 RESI\n2 PLAC 12 Lantern Ave, Marrowby\n')
  assert.equal(changes(OLD, cur), 'Ada Fenwick (I1)\n  Added: residence Marrowby\n  Added a note: “Write to [email]”')
})

test('records are data: they survive JSON, and a removed person keeps a snapshot for the living check', () => {
  const old = withWren(OLD)
  const records = JSON.parse(JSON.stringify(diffTrees(parseGedcom(old), parseGedcom(OLD))))
  assert.deepEqual(records.map(r => [r.kind, r.op, r.id]), [['person', 'removed', 'I7']])
  assert.equal(records[0].was.name, 'Wren Fenwick')
  const cur = parseGedcom(OLD)
  assert.deepEqual(describe(records, cur, PUBLIC, { year: 2026 }), [])
  assert.deepEqual(describe(records, cur, PUBLIC, { year: 2100 }), [{ id: 'I7', text: 'Removed: Wren Fenwick (I7)', lines: [] }])
})

test('renumbering guard: more than half of the old INDI xrefs missing stops the diff', () => {
  const renumber = ged => ged.replace(/@I(\d)@/g, '@P$1@')
  assert.throws(() => diffTrees(parseGedcom(OLD), parseGedcom(renumber(OLD))), /xrefs look renumbered/)
  const half = edit(OLD, /0 @I4@ INDI\n(?:[12] .*\n)*/, '', /0 @I5@ INDI\n(?:[12] .*\n)*/, '', /0 @I9@ INDI\n(?:[12] .*\n)*/, '')
  assert.doesNotThrow(() => diffTrees(parseGedcom(OLD), parseGedcom(half)), 'exactly half is not more than half')
})

const BIN = path.join(path.dirname(new URL(import.meta.url).pathname), '../build.mjs')

test('kinsite diff config old.ged prints the change list; kinsite never builds or touches git', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kinsite-diff-'))
  fs.writeFileSync(path.join(dir, 'tree.ged'), edit(OLD, '1 NAME Ada /Fenwick/', '1 NAME Ada /Pell/'))
  fs.writeFileSync(path.join(dir, 'old.ged'), OLD)
  fs.writeFileSync(path.join(dir, 'renumbered.ged'), OLD.replace(/@I(\d)@/g, '@P$1@'))
  fs.writeFileSync(path.join(dir, 'kinsite.config.json'), JSON.stringify({ gedcom: 'tree.ged', anonymizeLiving: true }))
  const out = execFileSync('node', [BIN, 'diff', 'kinsite.config.json', 'old.ged'], { cwd: dir, encoding: 'utf8' })
  assert.equal(out, 'Ada Pell (I1)\n  Changed name to Ada Pell\n')
  assert.deepEqual(fs.readdirSync(dir).sort(), ['kinsite.config.json', 'old.ged', 'renumbered.ged', 'tree.ged'])
  const guard = spawnSync('node', [BIN, 'diff', 'kinsite.config.json', 'renumbered.ged'], { cwd: dir, encoding: 'utf8' })
  assert.equal(guard.status, 1)
  assert.match(guard.stderr, /^error: xrefs look renumbered/)
  const usage = spawnSync('node', [BIN, 'diff', 'kinsite.config.json'], { cwd: dir, encoding: 'utf8' })
  assert.equal(usage.status, 2)
  assert.match(usage.stderr, /kinsite diff/)
  const missing = spawnSync('node', [BIN, 'diff', 'kinsite.config.json', 'nope.ged'], { cwd: dir, encoding: 'utf8' })
  assert.match(missing.stderr, /GEDCOM not found: nope\.ged/)
  fs.rmSync(dir, { recursive: true })
})

test('which side of the file records a parent link is not a change', () => {
  const both = edit(OLD, '1 CHIL @I2@\n', '1 CHIL @I2@\n1 CHIL @I1@\n', '1 FAMC @F1@\n1 FAMS', '1 FAMC @F1@\n1 FAMC @F2@\n1 FAMS')
  const familyOnly = edit(both, '1 FAMC @F2@\n', '')
  assert.equal(changes(familyOnly, both), 'No changes.')
  assert.equal(changes(both, familyOnly), 'No changes.')
  const childOnly = edit(both, '1 CHIL @I2@\n1 CHIL @I1@\n', '1 CHIL @I2@\n')
  assert.equal(changes(childOnly, edit(childOnly, '1 FAMC @F2@\n', '1 FAMC @F2@\n2 PEDI ADOPTED\n')),
    'Ada Fenwick (I1)\n  Relabeled as a child of Silas Fenwick and Hester Lowe from no label to adopted')
})

test('more than one marriage: the first is preferred, and a reorder, an added or a removed version each get a line', () => {
  const two = edit(OLD, '2 DATE 1880\n2 PLAC Marrowby\n', '2 DATE 16 JUL 1880\n2 PLAC Marrowby\n1 MARR\n2 DATE 5 JUL 1880\n3 PHRASE (9)?\n2 PLAC Marrowby\n')
  const swapped = edit(OLD, '2 DATE 1880\n2 PLAC Marrowby\n', '2 DATE 5 JUL 1880\n3 PHRASE (9)?\n2 PLAC Marrowby\n1 MARR\n2 DATE 16 JUL 1880\n2 PLAC Marrowby\n')
  assert.equal(changes(swapped, two),
    'Ada Fenwick (I1)\n  Preferred marriage to Jonas Pell is now 16 JUL 1880, Marrowby, not 5 JUL 1880 ((9)?), Marrowby')
  assert.equal(changes(swapped, two, PUBLIC), 'Ada Fenwick (I1)\n  Preferred marriage to Jonas Pell is now 16 JUL 1880, Marrowby')
  const one = edit(OLD, '2 DATE 1880', '2 DATE 16 JUL 1880')
  assert.equal(changes(one, two), 'Ada Fenwick (I1)\n  Added: marriage to Jonas Pell, 5 JUL 1880 ((9)?), Marrowby')
  assert.equal(changes(two, one), 'Ada Fenwick (I1)\n  Removed: marriage to Jonas Pell, 5 JUL 1880 ((9)?), Marrowby')
  assert.equal(changes(two, one, PUBLIC), 'Ada Fenwick (I1)\n  Removed a record of the marriage to Jonas Pell')
  assert.equal(changes(two, edit(two, '2 DATE 5 JUL 1880\n3 PHRASE (9)?\n', '2 DATE 6 JUL 1880\n')),
    'Ada Fenwick (I1)\n  Changed date of the marriage to Jonas Pell from 5 JUL 1880 ((9)?) to 6 JUL 1880')
  const hidden = edit(two, '3 PHRASE (9)?\n2 PLAC Marrowby\n', '3 PHRASE (9)?\n2 PLAC Marrowby\n2 RESN PRIVACY\n')
  assert.equal(changes(one, hidden), 'No changes.', 'a restricted version added')
  assert.equal(changes(hidden, one), 'No changes.', 'a restricted version removed')
  const unwed = edit(OLD, '1 HUSB @I9@\n', '', '1 FAMS @F3@\n0 @F1@', '0 @F1@')
  assert.equal(changes(unwed, two), 'Ada Fenwick (I1)\n  Added: marriage to Jonas Pell, 16 JUL 1880, Marrowby', 'a new couple gets one line, for the preferred marriage')
})
