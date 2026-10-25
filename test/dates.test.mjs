import { test } from 'node:test'
import assert from 'node:assert/strict'
import { birthYear } from '../lib/dates.mjs'

test('birthYear reads partial dates and ignores missing, unparseable and private ones', () => {
  assert.equal(birthYear({ birt: { date: '3 FEB 1841' } }), 1841)
  assert.equal(birthYear({ birt: { date: 'BET 1844 AND 1845' } }), 1844)
  assert.equal(birthYear({ birt: { date: 'ABT 190' } }), null)
  assert.equal(birthYear({ birt: {} }), null)
  assert.equal(birthYear({}), null)
  assert.equal(birthYear({ birt: { date: '1800', resn: 'PRIVACY' } }), null)
})

