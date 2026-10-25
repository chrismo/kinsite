import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Kin } from '../lib/kin.mjs'

// I1 + I2 -> I3, I4 ; I3 + I5 -> I6 ; I9 unrelated
const person = (id, famc, fams = []) => [id, { id, famc, fams }]
const family = (id, husb, wife, chil) => [id, { id, husb, wife, chil, marr: {} }]
const indi = new Map([
  person('I1', null, ['F1']), person('I2', null, ['F1']), person('I3', 'F1', ['F2']),
  person('I4', 'F1'), person('I5', null, ['F2']), person('I6', 'F2'), person('I9', null),
])
const fam = new Map([family('F1', 'I1', 'I2', ['I3', 'I4']), family('F2', 'I3', 'I5', ['I6'])])

test('parents and children', () => {
  const k = new Kin(indi, fam, 'I1')
  assert.deepEqual(k.parentsOf('I3'), ['I1', 'I2'])
  assert.deepEqual(k.parentsOf('I1'), [null, null])
  assert.deepEqual(k.parentsOf('nobody'), [null, null])
  assert.deepEqual(k.childrenOf('I3'), ['I6'])
})

test('relPath is the shortest parent/child chain back to the primary person', () => {
  const k = new Kin(indi, fam, 'I1')
  assert.deepEqual(k.relPath('I6'), ['I6', 'I3', 'I1'])
  assert.deepEqual(k.relPath('I5'), ['I5', 'I6', 'I3', 'I1'])
  assert.equal(k.relPath('I1'), null)
  assert.equal(k.relPath('I9'), null)
})

test('hop arrows point up to a parent and down to a child', () => {
  const k = new Kin(indi, fam, 'I1')
  assert.equal(k.hop('I6', 'I3'), '&uarr;')
  assert.equal(k.hop('I3', 'I6'), '&darr;')
  assert.equal(k.hop('I3', 'I4'), '&middot;')
})

test('primary falls back to I1, then the first person', () => {
  assert.equal(new Kin(indi, fam, 'I99').primary, 'I1')
  assert.equal(new Kin(indi, fam, null).primary, 'I1')
  const noI1 = new Map([...indi].filter(([id]) => id !== 'I1'))
  assert.equal(new Kin(noI1, fam, 'I99').primary, 'I2')
  assert.equal(new Kin(new Map(), fam, 'I9').primary, null)
})
