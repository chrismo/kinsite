import { test } from 'node:test'
import assert from 'node:assert/strict'
import { birthYear, byBirthYear } from '../lib/dates.mjs'

test('birthYear reads partial dates and ignores missing, unparseable and private ones', () => {
  assert.equal(birthYear({ birt: { date: '3 FEB 1841' } }), 1841)
  assert.equal(birthYear({ birt: { date: 'BET 1844 AND 1845' } }), 1844)
  assert.equal(birthYear({ birt: { date: 'ABT 190' } }), null)
  assert.equal(birthYear({ birt: {} }), null)
  assert.equal(birthYear({}), null)
  assert.equal(birthYear({ birt: { date: '1800', resn: 'PRIVACY' } }), null)
})

test('byBirthYear orders by year in either direction with undated people always last', () => {
  const ps = [{ n: 'a', birt: { date: '1900' } }, { n: 'b', birt: {} }, { n: 'c', birt: { date: '1850' } }, { n: 'd', birt: { date: '1900' } }]
  const names = dir => [...ps].sort(byBirthYear(dir)).map(p => p.n).join('')
  assert.equal(names(1), 'cadb')
  assert.equal(names(-1), 'adcb')
})
