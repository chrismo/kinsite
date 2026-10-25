import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadConfig, DEFAULTS } from '../lib/config.mjs'

function configFile(obj) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kinsite-config-'))
  const file = path.join(dir, 'kinsite.config.json')
  fs.writeFileSync(file, JSON.stringify(obj))
  return { dir, file }
}

test('paths resolve against the config file directory', () => {
  const { dir, file } = configFile({ gedcom: 'data/tree.ged', out: 'build/site', mediaRoot: 'data' })
  const c = loadConfig(file)
  assert.equal(c.gedcom, path.join(dir, 'data/tree.ged'))
  assert.equal(c.out, path.join(dir, 'build/site'))
  assert.equal(c.mediaRoot, path.join(dir, 'data'))
  fs.rmSync(dir, { recursive: true })
})

test('defaults fill what the config leaves out; media resolves from the config directory', () => {
  const { dir, file } = configFile({ gedcom: 'tree.ged' })
  const c = loadConfig(file)
  assert.equal(c.title, DEFAULTS.title)
  assert.equal(c.focus, null)
  assert.equal(c.out, path.join(dir, 'site'))
  assert.equal(c.mediaRoot, dir)
  fs.rmSync(dir, { recursive: true })
})

test('title and focus pass through', () => {
  const { dir, file } = configFile({ gedcom: 'x.ged', title: 'The Quill Family', focus: 'I3' })
  const c = loadConfig(file)
  assert.equal(c.title, 'The Quill Family')
  assert.equal(c.focus, 'I3')
  fs.rmSync(dir, { recursive: true })
})

test('overrides win over the file', () => {
  const { dir, file } = configFile({ gedcom: 'x.ged', focus: 'I3' })
  assert.equal(loadConfig(file, { focus: 'I9' }).focus, 'I9')
  assert.equal(loadConfig(file, { focus: undefined }).focus, 'I3')
  fs.rmSync(dir, { recursive: true })
})

test('a config without a gedcom path, or with unknown keys, is an error', () => {
  const a = configFile({ title: 'x' })
  assert.throws(() => loadConfig(a.file), /gedcom/)
  const b = configFile({ gedcom: 'x.ged', titel: 'typo' })
  assert.throws(() => loadConfig(b.file), /unknown config key: titel/)
  fs.rmSync(a.dir, { recursive: true })
  fs.rmSync(b.dir, { recursive: true })
})
