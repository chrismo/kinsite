import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { piiValues, findLeaks, findContactText } from '../lib/pii.mjs'
import { buildSite } from '../lib/build.mjs'

const GED = `0 HEAD
1 GEDC
2 VERS 7.0
0 @SUB1@ SUBM
1 ADDR 3 Wickerlane Rd.
2 CONT Marrowby, QX 00000
1 PHON 555-555-0101
1 EMAIL submitter@example.com
0 @I1@ INDI
1 RESI
2 ADDR 12 Lantern Ln.
3 ADR1 12 Lantern Ln.
3 POST 00001
2 PHON +1 555 555 0199
0 TRLR
`

function site(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kinsite-pii-'))
  for (const [f, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true })
    fs.writeFileSync(path.join(dir, f), text)
  }
  return dir
}

test('PII values come from ADDR first lines, ADR1, POST, PHON and EMAIL', () => {
  assert.deepEqual(piiValues(GED).sort(),
    ['+1 555 555 0199', '00001', '12 Lantern Ln.', '3 Wickerlane Rd.', '555-555-0101', 'submitter@example.com'])
})

test('findLeaks reports each text file that contains a PII value, raw or HTML-escaped', () => {
  const dir = site({
    'clean.html': '<p>Marrowby</p>',
    'I1.html': '<p>call 555-555-0101</p>',
    'I2.html': '<p>12 Lantern Ln. &amp; bram&amp;co@example.com</p>',
    'media/photo.jpg': '555-555-0101',
  })
  assert.deepEqual(findLeaks(['555-555-0101', '12 Lantern Ln.', 'bram&co@example.com'], dir), [
    { file: 'I1.html', value: '555-555-0101' },
    { file: 'I2.html', value: '12 Lantern Ln.' },
    { file: 'I2.html', value: 'bram&co@example.com' },
  ])
  fs.rmSync(dir, { recursive: true })
})

test('findContactText catches contact details that look like PII even when the GEDCOM did not tag them', () => {
  const dir = site({
    'index.html': '<p>Marrowby, 1890</p>',
    'I1.html': '<p>write submitter@example.com or call 555-555-0142</p>',
  })
  assert.deepEqual(findContactText(dir), [
    { file: 'I1.html', value: 'submitter@example.com' },
    { file: 'I1.html', value: '555-555-0142' },
  ])
  fs.rmSync(dir, { recursive: true })
})

test('contact details in event notes, citations and source titles do not reach the built site; citations can be turned off', () => {
  const dir = site({ 'tree.ged': `0 HEAD
1 GEDC
2 VERS 7.0
0 @I1@ INDI
1 NAME Hollis /Fernwhistle/
1 DEAT
2 DATE 1911
2 NOTE Ask the sexton at 555-555-0142
2 SOUR @S1@
3 PAGE Box 12
3 DATA
4 TEXT Write to 4 Mill Rd for a copy
3 NOTE sexton@example.com
1 SOUR @S1@
2 PAGE call 555-555-0143
0 @S1@ SOUR
1 TITL Letters kept at 9 Lantern Ave
0 TRLR
` })
  const out = path.join(dir, 'site')
  buildSite({ gedcom: path.join(dir, 'tree.ged'), out, mediaRoot: dir }, { log: () => {} })
  const page = fs.readFileSync(path.join(out, 'I1.html'), 'utf8')
  assert.match(page, /Ask the sexton at \[phone\]/)
  assert.match(page, /<h2>Sources<\/h2>/)
  assert.deepEqual(findContactText(out), [])
  buildSite({ gedcom: path.join(dir, 'tree.ged'), out, mediaRoot: dir, citations: false }, { log: () => {} })
  const bare = fs.readFileSync(path.join(out, 'I1.html'), 'utf8')
  assert.match(bare, /Ask the sexton/)
  assert.doesNotMatch(bare, /Sources|class=cite/)
  buildSite({ gedcom: path.join(dir, 'tree.ged'), out, mediaRoot: dir, notes: false }, { log: () => {} })
  const quiet = fs.readFileSync(path.join(out, 'I1.html'), 'utf8')
  assert.doesNotMatch(quiet, /Ask the sexton/)
  assert.match(quiet, /<h2>Sources<\/h2>/)
  fs.rmSync(dir, { recursive: true })
})
