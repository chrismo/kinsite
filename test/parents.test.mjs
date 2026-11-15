import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseGedcom } from '../lib/gedcom.mjs'
import { Kin } from '../lib/kin.mjs'
import { Renderer } from '../lib/render.mjs'
import { anonymize } from '../lib/living.mjs'
import { hourglassLayout } from '../lib/hourglass.mjs'
import { buildSite } from '../lib/build.mjs'

// Invented. Ada is listed as a child of her parents (F1) and, by a merge error, of her grandparents (F2).
const people = `0 @I1@ INDI
1 NAME Ada /Fenwick/
1 BIRT
2 DATE 1859
1 FAMC @F1@
1 FAMC @F2@
0 @I2@ INDI
1 NAME Tobias /Fenwick/
1 BIRT
2 DATE 1825
1 FAMC @F2@
1 FAMS @F1@
0 @I3@ INDI
1 NAME Mara /Quill/
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
`
const families = `0 @F1@ FAM
1 HUSB @I2@
1 WIFE @I3@
1 CHIL @I1@
0 @F2@ FAM
1 HUSB @I4@
1 WIFE @I5@
1 CHIL @I2@
1 CHIL @I1@
0 TRLR
`
const ADA = people + families
const withAda = famc => ADA.replace('1 FAMC @F1@\n1 FAMC @F2@\n', famc)

function site(ged, { anonymizeLiving = false, year } = {}) {
  const parsed = parseGedcom(ged)
  const { indi, fam } = anonymizeLiving ? anonymize(parsed.indi, parsed.fam, year) : parsed
  const kin = new Kin(indi, fam, 'I3')
  const r = new Renderer({ indi, fam, kin, copied: new Map() })
  return { indi, fam, kin, page: id => r.personPage(id).html }
}
const section = (html, h) => html.split(/<h2>|<footer>/).find(s => s.startsWith(h)) ?? ''
const text = s => s.replace(/<[^>]+>/g, '').replace(/&middot;/g, '·').replace(/&uarr;/g, '↑').replace(/&amp;/g, '&')

test('every FAMC is kept in file order with its PEDI, PHRASE and STAT; the first not DISPROVEN is the main family', () => {
  const { indi } = parseGedcom(withAda(`1 FAMC @F2@
2 STAT DISPROVEN
1 FAMC @F1@
2 PEDI OTHER
3 PHRASE Raised by
2 STAT proven
`))
  const ada = indi.get('I1')
  assert.deepEqual(ada.parentFams, [
    { fam: 'F2', pedi: '', phrase: '', stat: 'DISPROVEN' },
    { fam: 'F1', pedi: 'OTHER', phrase: 'Raised by', stat: 'PROVEN' },
  ])
  assert.equal(ada.famc, 'F1')
  assert.equal(parseGedcom(ADA).indi.get('I1').famc, 'F1', 'the first FAMC wins, not the last')
})

test('PROVEN is a label and does not reorder; with every FAMC disproven there is no main family', () => {
  assert.equal(parseGedcom(withAda('1 FAMC @F2@\n1 FAMC @F1@\n2 STAT PROVEN\n')).indi.get('I1').famc, 'F2')
  assert.equal(parseGedcom(withAda('1 FAMC @F1@\n2 STAT DISPROVEN\n1 FAMC @F2@\n2 STAT DISPROVEN\n')).indi.get('I1').famc, null)
})

test('the ancestor path and every chart view use the main family only', () => {
  const { kin, indi, fam } = site(ADA)
  assert.deepEqual(kin.parentsOf('I1'), ['I2', 'I3'])
  assert.deepEqual(kin.childrenOf('I4'), ['I2'])
  assert.equal(kin.hop('I1', 'I3'), '&uarr;')
  const ids = layout => layout.boxes.map(b => b.id).filter(Boolean)
  assert.ok(!ids(hourglassLayout('I4', { indi, fam })).includes('I1'), 'Ada is not charted as a child of her grandparents')
  assert.deepEqual(ids(hourglassLayout('I2', { indi, fam })).sort(), ['I1', 'I2', 'I3', 'I4', 'I5'])
})

test('a child page shows its main parents and lists the other families it is in', () => {
  const ada = site(ADA).page('I1')
  assert.deepEqual(text(section(ada, 'Parents')).split(/(?=Tobias|Mara|Also)/).map(s => s.trim()), [
    'Parents', 'Tobias Fenwick (1825–)', 'Mara Quill (1830–)',
    'Also listed as a child of Silas Fenwick (1795–) and Hester Lowe (1798–)',
  ])
  assert.equal(section(ada, 'Siblings'), '', 'her father is not her sibling')
  assert.match(text(ada), /Path to Mara Quill \(1 steps\)Ada Fenwick \(1859–\) ↑ Mara Quill \(1830–\)/)
  assert.equal(section(site(ADA).page('I2'), 'Siblings'), '', 'his daughter is not his sibling')
})

test('the other parents list the child with a pointer to the main parents', () => {
  const silas = text(section(site(ADA).page('I4'), 'Spouse &amp; children'))
  assert.match(silas, /Tobias Fenwick \(1825–\)Ada Fenwick \(1859–\) \(main parents: Tobias Fenwick and Mara Quill\)/)
  assert.match(text(section(site(ADA).page('I2'), 'Spouse &amp; children')), /Ada Fenwick \(1859–\)$/)
})

test('labels: PEDI other than BIRTH and any STAT on the main family, and every label on the others', () => {
  const ged = withAda(`1 FAMC @F1@
2 PEDI ADOPTED
2 STAT CHALLENGED
1 FAMC @F2@
2 PEDI OTHER
3 PHRASE Guardianship
`)
  const parents = text(section(site(ged).page('I1'), 'Parents'))
  assert.match(parents, /^Parentsadopted, challenged/)
  assert.match(parents, /Also listed as a child of Silas Fenwick \(1795–\) and Hester Lowe \(1798–\) Guardianship$/)
  assert.match(text(site(ged).page('I4')), /\(Guardianship; main parents: Tobias Fenwick and Mara Quill\)/)

  const plain = withAda('1 FAMC @F1@\n2 PEDI BIRTH\n1 FAMC @F2@\n2 PEDI BIRTH\n2 STAT DISPROVEN\n')
  const p = text(section(site(plain).page('I1'), 'Parents'))
  assert.match(p, /^ParentsTobias/, 'a BIRTH main family has no label')
  assert.match(p, /Hester Lowe \(1798–\) birth, disproven$/)
  assert.match(text(section(site(withAda('1 FAMC @F1@\n1 FAMC @F2@\n2 PEDI OTHER\n')).page('I1'), 'Parents')), / other$/)
})

test('a child with no main family lists every family it is in, each labeled', () => {
  const ged = withAda('1 FAMC @F1@\n2 STAT DISPROVEN\n1 FAMC @F2@\n2 STAT DISPROVEN\n')
  const parents = text(section(site(ged).page('I1'), 'Parents'))
  assert.match(parents, /^ParentsAlso listed as a child of Tobias Fenwick \(1825–\) and Mara Quill \(1830–\) disproven/)
  assert.match(text(site(ged).page('I2')), /Ada Fenwick \(1859–\) \(disproven\)/)
})

test('with anonymizeLiving a DISPROVEN family is left out', () => {
  const ged = withAda('1 FAMC @F1@\n1 FAMC @F2@\n2 STAT DISPROVEN\n')
  assert.match(site(ged).page('I1'), /disproven/)
  const s = site(ged, { anonymizeLiving: true, year: 2026 })
  assert.doesNotMatch(s.page('I1'), /Also listed|disproven/)
  assert.doesNotMatch(section(s.page('I4'), 'Spouse'), /Ada/)
  assert.deepEqual(s.fam.get('F2').chil, ['I2'])
})

test('with anonymizeLiving a Private person keeps only the main family, with no labels and no "also listed" lines', () => {
  const ged = withAda('1 FAMC @F1@\n2 PEDI ADOPTED\n1 FAMC @F2@\n2 PEDI BIRTH\n').replace('2 DATE 1859', '2 DATE 1990')
  const s = site(ged, { anonymizeLiving: true, year: 2026 })
  assert.deepEqual(s.indi.get('I1').parentFams, [{ fam: 'F1', pedi: '', phrase: '', stat: '' }])
  assert.deepEqual(s.fam.get('F2').chil, ['I2'])
  assert.deepEqual(s.fam.get('F1').chil, ['I1'])
  for (const id of ['I1', 'I2', 'I3', 'I4', 'I5']) assert.doesNotMatch(s.page(id), /adopted|birth|Also listed|main parents/i)
})

test('one-sided family links are warned about and the child side is joined up', () => {
  const ged = `0 @I1@ INDI
1 FAMC @F1@
1 FAMS @F2@
0 @I2@ INDI
0 @I3@ INDI
1 FAMS @F1@
0 @F1@ FAM
1 HUSB @I3@
1 WIFE @I2@
1 CHIL @I2@
0 @F2@ FAM
0 TRLR
`
  const { indi, fam, warnings } = parseGedcom(ged)
  assert.deepEqual(warnings, [
    'I1 FAMC @F1@ has no matching CHIL in F1',
    'I1 FAMS @F2@ has no matching HUSB or WIFE in F2',
    'F1 WIFE @I2@ has no matching FAMS in I2',
    'F1 CHIL @I2@ has no matching FAMC in I2',
  ])
  assert.deepEqual(fam.get('F1').chil, ['I2', 'I1'])
  assert.deepEqual(indi.get('I2').parentFams, [{ fam: 'F1', pedi: '', phrase: '', stat: '' }])
  assert.equal(indi.get('I2').famc, 'F1')
  assert.deepEqual(parseGedcom(ADA).warnings, [])
})

test('the build logs one-sided links', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kinsite-parents-'))
  const ged = path.join(dir, 'tree.ged')
  fs.writeFileSync(ged, ADA.replace('1 CHIL @I2@\n', ''))
  const lines = []
  buildSite({ gedcom: ged, out: path.join(dir, 'site'), mediaRoot: dir, focus: 'I1' }, { log: s => lines.push(s) })
  fs.rmSync(dir, { recursive: true })
  assert.deepEqual(lines.filter(s => s.includes('warning')), ['  warning: I2 FAMC @F2@ has no matching CHIL in F2'])
})
