import { test } from 'node:test'
import assert from 'node:assert/strict'
import { place, redact } from '../lib/redact.mjs'

test('place drops street addresses and boxes and keeps the rest as written', () => {
  assert.equal(place('9 Copperbeech Rd, Saltmere, Westmarch'), 'Saltmere, Westmarch')
  assert.equal(place('207 Halyard, Saltmere, Westmarch'), 'Saltmere, Westmarch')
  assert.equal(place('15 Old Orchard Lane Saltmere'), 'Saltmere')
  assert.equal(place('Saltmere, Westmarch,'), 'Saltmere, Westmarch,')
  assert.equal(place('3 Gull Ct'), '')
  assert.equal(place('RR 4 Box 88, Kettleby, Westmarch'), 'Kettleby, Westmarch')
  assert.equal(place('Boxholm Ferry, Westmarch'), 'Boxholm Ferry, Westmarch')
  assert.equal(place('rented rooms above 5 N. Quay St. Kettleby'), 'rented rooms above Kettleby')
  assert.equal(place('Saltmere Lifeboat House 2 Harbour Way Saltmere'), 'Saltmere Lifeboat House Saltmere')
})

test('redact replaces phones, emails, street addresses, boxes and zip codes', () => {
  assert.equal(redact('ring the harbourmaster on 555-555-0142 after six'), 'ring the harbourmaster on [phone] after six')
  assert.equal(redact('or (555) 555-0188'), 'or [phone]')
  assert.equal(redact('send word to kettleby.post@example.org'), 'send word to [email]')
  assert.equal(redact('Route 2 Box 14, Kettleby, QX 00000'), '[address], Kettleby, QX [address]')
  assert.equal(redact('HCRT 3, Kettleby'), '[address], Kettleby')
  assert.equal(redact('moved to #6 Tidewater Blvd. last spring'), 'moved to [address] last spring')
  assert.equal(redact('PO Box 9'), '[address]')
  assert.equal(redact('aged 71, 4 grandchildren, FROM 2052 TO 2069'), 'aged 71, 4 grandchildren, FROM 2052 TO 2069')
})
