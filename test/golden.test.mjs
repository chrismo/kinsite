// Pins the built sample site byte for byte. After an intended output change:
//   UPDATE_GOLDEN=1 node --test test/golden.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadConfig } from '../lib/config.mjs'
import { buildSite } from '../lib/build.mjs'

const HERE = path.dirname(new URL(import.meta.url).pathname)
const GOLDEN = path.join(HERE, 'golden.sha256')
const CONFIG = path.join(HERE, '../sample/kinsite.config.json')

function hashes(dir) {
  return fs.readdirSync(dir, { recursive: true }).sort()
    .filter(f => fs.statSync(path.join(dir, f)).isFile())
    .map(f => `${crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, f))).digest('hex')}  ${f}`)
    .join('\n') + '\n'
}

test('the sample site matches the golden hashes', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'kinsite-golden-'))
  const stats = buildSite(loadConfig(CONFIG, { out }), { log: () => {} })
  assert.ok(stats.individuals > 10, 'sample has people')
  assert.ok(stats.withPhoto > 0, 'sample has a photo')
  const got = hashes(out)
  fs.rmSync(out, { recursive: true })
  if (process.env.UPDATE_GOLDEN) fs.writeFileSync(GOLDEN, got)
  assert.equal(got, fs.readFileSync(GOLDEN, 'utf8'))
})

test('the sample site names the sample, not anything baked into the code', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'kinsite-golden-'))
  buildSite(loadConfig(CONFIG, { out }), { log: () => {} })
  const index = fs.readFileSync(path.join(out, 'index.html'), 'utf8')
  fs.rmSync(out, { recursive: true })
  assert.match(index, /<h1>The Quill &amp; Rook Families<\/h1>/)
  assert.match(index, /<code>quill-rook\.ged<\/code>/)
  assert.match(index, /<h2>Family of Gideon Osric Quill<\/h2>/)
})

test('the build log says what was published', () => {
  const published = overrides => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'kinsite-golden-'))
    const lines = []
    buildSite(loadConfig(CONFIG, { out, ...overrides }), { log: s => lines.push(s) })
    fs.rmSync(out, { recursive: true })
    return lines.filter(s => s.includes('published'))
  }
  assert.deepEqual(published({}), ['  published   : citations shown, notes shown, living shown'])
  assert.deepEqual(published({ citations: false, notes: false, anonymizeLiving: true }),
    ['  published   : citations hidden, notes hidden, living anonymized'])
})

test('focus override re-centers the site', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'kinsite-golden-'))
  buildSite(loadConfig(CONFIG, { out, focus: 'I1' }), { log: () => {} })
  const index = fs.readFileSync(path.join(out, 'index.html'), 'utf8')
  fs.rmSync(out, { recursive: true })
  assert.match(index, /<h2>Family of Abner Quill<\/h2>/)
})

test('refuses an output directory that holds the GEDCOM or the media, since it is deleted first', () => {
  const config = loadConfig(CONFIG)
  for (const out of [path.dirname(config.gedcom), path.dirname(path.dirname(config.gedcom)), config.mediaRoot]) {
    assert.throws(() => buildSite({ ...config, out }, { log: () => {} }), /refusing to delete/)
  }
  assert.ok(fs.existsSync(config.gedcom))
})
