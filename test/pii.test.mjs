import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { piiValues, findLeaks, findContactText } from '../lib/pii.mjs'

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
