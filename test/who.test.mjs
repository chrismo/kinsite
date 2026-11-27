import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { parseGedcom } from '../lib/gedcom.mjs'
import { createServer } from '../scripts/serve.mjs'
import {
  whoPhotos, peopleList, linkedBoxes, seedSession, cleanSession, mergeGedcom, suggest, groups, linkBlocks, whoHandler,
} from '../scripts/who.mjs'

const GED = `0 HEAD
0 @I1@ INDI
1 NAME Ada /Fenwick/
1 BIRT
2 DATE 1880
1 DEAT
2 DATE 1950
1 OBJE @O1@
2 CROP
3 TOP 60
3 LEFT 500
3 HEIGHT 300
3 WIDTH 200
2 TITL Ada, on the right
0 @I2@ INDI
1 NAME Bram /Fenwick/
1 BIRT
2 DATE 1905
1 OBJE @O1@
0 @I3@ INDI
1 NAME Cass /Moor/
1 BIRT
2 DATE 1700
1 DEAT
2 DATE 1760
0 @I4@ INDI
1 NAME Dell /Moor/
1 DEAT
2 DATE 1930
0 @I5@ INDI
1 NAME Zoë /Moor/
1 BIRT
2 DATE 2001
1 OBJE @O3@
0 @O1@ OBJE
1 FILE picnic.png
2 TITL The picnic, about 1912
0 @O2@ OBJE
1 FILE letter.pdf
0 @O3@ OBJE
1 FILE nobody.png
0 @O4@ OBJE
1 FILE unlinked.png
0 TRLR
`
const parsed = parseGedcom(GED)
const SIZE = { width: 1000, height: 600 }
const png = ({ width, height }) => {
  const b = Buffer.alloc(33)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b)
  b.writeUInt32BE(13, 8)
  b.write('IHDR', 12, 'latin1')
  b.writeUInt32BE(width, 16)
  b.writeUInt32BE(height, 20)
  return b
}
const box = (left, top, width, height, more = {}) => ({ left, top, width, height, who: '', guess: false, caption: '', note: '', ...more })

test('every image OBJE is a photo to identify, linked or not, with its links and their crops', () => {
  const photos = whoPhotos(parsed)
  assert.deepEqual([...photos.keys()], ['O1', 'O3', 'O4'])
  assert.deepEqual(photos.get('O1'), {
    oid: 'O1', file: 'picnic.png', title: 'The picnic, about 1912', links: [
      { pid: 'I1', caption: 'Ada, on the right', crop: { top: 60, left: 500, height: 300, width: 200 } },
      { pid: 'I2', caption: '', crop: undefined },
    ],
  })
  assert.deepEqual(photos.get('O4').links, [])
})

test('people to choose from carry their birth and death years, sorted by surname', () => {
  assert.deepEqual(peopleList(parsed.indi).map(p => [p.id, p.name, p.life, p.b, p.d]), [
    ['I1', 'Ada Fenwick', '1880–1950', 1880, 1950],
    ['I2', 'Bram Fenwick', '1905–', 1905, null],
    ['I3', 'Cass Moor', '1700–1760', 1700, 1760],
    ['I4', 'Dell Moor', '–1930', null, 1930],
    ['I5', 'Zoë Moor', '2001–', 2001, null],
  ])
})

test('a new session starts from the GEDCOM: a box for each crop, and the year from the title', () => {
  const photo = whoPhotos(parsed).get('O1')
  assert.deepEqual(linkedBoxes(photo, SIZE), {
    I1: { caption: 'Ada, on the right', box: { left: 500, top: 60, width: 200, height: 300 } },
    I2: { caption: '', box: null },
  })
  assert.deepEqual(seedSession(photo, SIZE), {
    year: '1912', file: 'picnic.png', base: linkedBoxes(photo, SIZE), boxes: [box(500, 60, 200, 300, { who: 'I1', caption: 'Ada, on the right' })],
  })
  assert.deepEqual(seedSession(photo, null).boxes, [], 'no size, no boxes')
  assert.deepEqual(seedSession(whoPhotos(parsed).get('O4'), SIZE), { year: '', file: 'unlinked.png', base: {}, boxes: [] })
})

test('a saved session is cleaned: whole pixels, known answers, bounded text, no empty boxes', () => {
  assert.deepEqual(cleanSession({
    year: '1912', file: 'picnic.png', extra: 1,
    base: { I1: { caption: 'Ada', box: { left: 1, top: 2, width: 3, height: 4 } }, I2: { caption: '', box: null }, 'x y': {}, I3: 'nope' },
    boxes: [
      { left: 10.6, top: -4, width: 20.2, height: 30, who: 'I2', guess: true, caption: 'x'.repeat(600), note: 'n', junk: 1 },
      { left: 1, top: 1, width: 0, height: 9, who: 'I1' },
      { left: 1, top: 1, width: 9, height: 9, who: 'not in tree' },
      { left: 1, top: 1, width: 9, height: 9, who: 'not sure', guess: 'yes' },
      { left: 1, top: 1, width: 9, height: 9, who: '<script>' },
      'nope',
    ],
  }), {
    year: '1912', file: 'picnic.png',
    base: { I1: { caption: 'Ada', box: { left: 1, top: 2, width: 3, height: 4 } }, I2: { caption: '', box: null } },
    boxes: [
      box(11, 0, 20, 30, { who: 'I2', guess: true, caption: 'x'.repeat(500), note: 'n' }),
      box(1, 1, 9, 9, { who: 'not in tree' }),
      box(1, 1, 9, 9, { who: 'not sure' }),
      box(1, 1, 9, 9),
    ],
  })
  assert.deepEqual(cleanSession({ year: 'about 1912', boxes: [] }), { year: '', file: '', base: {}, boxes: [] })
  for (const bad of [null, [], 'x', { boxes: 'x' }, {}]) assert.equal(cleanSession(bad), null, JSON.stringify(bad))
})

test('a saved session takes crops changed in the GEDCOM since it last saw them, and keeps its own edits', () => {
  const B = (left, top, width, height) => ({ left, top, width, height })
  const base = { I1: { caption: 'Ada', box: B(500, 60, 200, 300) }, I2: { caption: '', box: null }, I4: { caption: '', box: B(9, 9, 9, 9) } }
  const now = { ...base, I2: { caption: 'Bram', box: B(5, 6, 7, 8) }, I4: { caption: 'Dell', box: B(1, 2, 3, 4) } }
  const session = { year: '1912', file: 'picnic.png', base, boxes: [
    box(510, 60, 200, 300, { who: 'I1', caption: 'Ada' }),
    box(9, 9, 9, 9, { who: 'I4', guess: true, note: 'kept' }),
  ] }
  const { session: merged, updated } = mergeGedcom(session, now)
  assert.deepEqual(updated, ['I2', 'I4'])
  assert.deepEqual(merged, { year: '1912', file: 'picnic.png', base: now, boxes: [
    box(510, 60, 200, 300, { who: 'I1', caption: 'Ada' }),
    box(1, 2, 3, 4, { who: 'I4', caption: 'Dell', note: 'kept' }),
    box(5, 6, 7, 8, { who: 'I2', caption: 'Bram' }),
  ] })
  assert.equal(session.boxes[1].left, 9, 'the saved session is not changed in place')
  const removed = mergeGedcom({ ...session, base: now }, { ...now, I4: { caption: '', box: null } })
  assert.deepEqual(removed.updated, [], 'a crop removed in the GEDCOM leaves the box for you to decide')
  assert.equal(removed.session.boxes.length, 2)
})

test('name search puts people linked to the photo first, then people alive when it was taken', () => {
  const people = peopleList(parsed.indi)
  const ids = (q, year = '1912') => suggest(people, q, year, ['I2']).map(p => [p.id, p.tier])
  assert.deepEqual(ids(''), [['I2', 'linked'], ['I1', 'alive'], ['I4', 'alive'], ['I3', ''], ['I5', '']])
  assert.deepEqual(ids('moor'), [['I4', 'alive'], ['I3', ''], ['I5', '']])
  assert.deepEqual(ids('FENW ada'), [['I1', 'alive']])
  assert.deepEqual(ids('zoe'), [['I5', '']], 'accents fold')
  assert.deepEqual(ids('i3'), [['I3', '']], 'an ID matches')
  assert.deepEqual(ids('', ''), [['I2', 'linked'], ['I1', ''], ['I3', ''], ['I4', ''], ['I5', '']], 'no year, no lifespan order')
  assert.equal(suggest(people, '', '1912', [], 2).length, 2)
})

test('boxes sort into placed, guessed, unknown and to place, with linked people who have no box', () => {
  const boxes = [
    box(0, 0, 9, 9, { who: 'I1' }), box(0, 0, 9, 9, { who: 'I4', guess: true }), box(0, 0, 9, 9, { who: 'not in tree' }),
    box(0, 0, 9, 9, { who: 'not sure' }), box(0, 0, 9, 9), box(0, 0, 9, 9, { who: 'I9' }),
  ]
  const names = { I1: 'Ada Fenwick', I2: 'Bram Fenwick', I4: 'Dell Moor' }
  assert.deepEqual(groups(boxes, ['I1', 'I2'], names), { placed: [0], guessed: [1], unknown: [2, 3], open: [4, 5], unboxed: ['I2'] })
})

test('GEDCOM lines for each placed person whose link is new or differs; guesses and unknowns stay out', () => {
  const linked = linkedBoxes(whoPhotos(parsed).get('O1'), SIZE)
  const names = { I1: 'Ada Fenwick', I2: 'Bram Fenwick', I4: 'Dell Moor' }
  const ada = box(500, 60, 200, 300, { who: 'I1', caption: 'Ada, on the right' })
  assert.deepEqual(linkBlocks('O1', [ada], linked, names), { blocks: [], same: 1 })
  const out = linkBlocks('O1', [
    { ...ada, caption: '' },
    box(10, 20, 30, 40, { who: 'I2', caption: '@home\nfront row', note: 'notes stay out' }),
    box(1, 2, 3, 4, { who: 'I4' }),
    box(1, 2, 3, 4, { who: 'I1', guess: true }),
    box(1, 2, 3, 4, { who: 'not in tree' }),
  ], linked, names)
  assert.equal(out.same, 0)
  assert.deepEqual(out.blocks, [
    { pid: 'I1', name: 'Ada Fenwick', status: 'changed', text: '1 OBJE @O1@\n2 CROP\n3 TOP 60\n3 LEFT 500\n3 HEIGHT 300\n3 WIDTH 200' },
    { pid: 'I2', name: 'Bram Fenwick', status: 'changed', text: '1 OBJE @O1@\n2 CROP\n3 TOP 20\n3 LEFT 10\n3 HEIGHT 40\n3 WIDTH 30\n2 TITL @@home front row' },
    { pid: 'I4', name: 'Dell Moor', status: 'new', text: '1 OBJE @O1@\n2 CROP\n3 TOP 2\n3 LEFT 1\n3 HEIGHT 4\n3 WIDTH 3' },
  ])
})

let dir, server
const req = (p, { method = 'GET', body, headers = {}, host } = {}) => new Promise((resolve, reject) => {
  const r = http.request({ host: '127.0.0.1', port: server.address().port, path: p, method, headers: { ...(host && { host }), ...headers } }, res => {
    const chunks = []
    res.on('data', c => chunks.push(c))
    res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], body: Buffer.concat(chunks).toString() }))
  })
  r.on('error', reject)
  r.end(body)
})
const post = (p, data, headers = { 'content-type': 'application/json' }, more = {}) => req(p, { method: 'POST', body: JSON.stringify(data), headers, ...more })
const sessionFile = () => path.join(dir, 'sessions', 'O1.json')

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kinsite-who-'))
  fs.writeFileSync(path.join(dir, 'tree.ged'), GED.replace('Ada, on the right', 'Ada </script> on the right'))
  fs.writeFileSync(path.join(dir, 'picnic.png'), png(SIZE))
  fs.writeFileSync(path.join(dir, 'kinsite.config.json'), JSON.stringify({ gedcom: 'tree.ged', who: 'sessions' }))
  server = createServer(() => path.join(dir, 'site'), { version: 1 }, whoHandler(path.join(dir, 'kinsite.config.json')))
  await new Promise(r => server.listen(0, '127.0.0.1', r))
})
after(() => {
  server.close()
  fs.rmSync(dir, { recursive: true })
})

test('/who lists each photo with how many are placed and still to place', async () => {
  const r = await req('/who')
  assert.equal(r.status, 200)
  assert.match(r.type, /^text\/html/)
  assert.match(r.body, /<a href="\/who\/O1">The picnic, about 1912<\/a>/)
  assert.match(r.body, /O1.*1 placed.*1 to place/s)
  assert.match(r.body, /<a href="\/who\/O4">unlinked\.png<\/a>/)
  assert.doesNotMatch(r.body, /letter\.pdf/)
})

test('/who/O1 opens the photo seeded from the GEDCOM, with captions escaped inside the script', async () => {
  const r = await req('/who/O1')
  assert.equal(r.status, 200)
  assert.match(r.body, /<img id=photo src="\/who\/O1\/image"/)
  assert.equal(r.body.match(/<\/script>/g).length, 1, 'a caption cannot close the script early')
  const data = JSON.parse(r.body.match(/const DATA = (.*?);\n/)[1])
  assert.deepEqual(data.size, SIZE)
  assert.equal(data.saved, false)
  assert.deepEqual(data.session.boxes.map(b => b.who), ['I1'])
  assert.deepEqual(data.linkedIds, ['I1', 'I2'])
})

test('/who/O1/image serves the file; unknown photos and odd paths are 404', async () => {
  const r = await req('/who/O1/image')
  assert.equal(r.status, 200)
  assert.equal(r.type, 'image/png')
  for (const p of ['/who/O2', '/who/O9', '/who/O3/image', '/who/..%2fkinsite.config.json', '/who/O1/../../tree.ged']) {
    assert.equal((await req(p)).status, 404, p)
  }
})

test('saving writes the session into the config\'s who folder, and the page then opens from it', async () => {
  const seeded = JSON.parse((await req('/who/O1')).body.match(/const DATA = (.*?);\n/)[1]).session
  const session = { ...seeded, year: '1913', boxes: [box(1, 2, 30, 40, { who: 'I2', guess: true, note: 'Aunt says so' })] }
  const r = await post('/who/O1', session)
  assert.equal(r.status, 204)
  const saved = JSON.parse(fs.readFileSync(sessionFile(), 'utf8'))
  assert.equal(saved.obje, 'O1')
  assert.deepEqual(cleanSession(saved), session)
  const data = JSON.parse((await req('/who/O1')).body.match(/const DATA = (.*?);\n/)[1])
  assert.equal(data.saved, true)
  assert.deepEqual(data.session, session)
  assert.match((await req('/who')).body, /O1.*0 placed.*1 to place/s, 'counts come from the session')
})

test('a session saved for another file is flagged, as after the GEDCOM\'s IDs are renumbered', async () => {
  const saved = fs.readFileSync(sessionFile(), 'utf8')
  fs.writeFileSync(sessionFile(), saved.replace('"file": "picnic.png"', '"file": "wedding.png"'))
  assert.match((await req('/who/O1')).body, /class=warn>This session was saved for <code>wedding\.png<\/code>/)
  assert.match((await req('/who')).body, /O1.*saved for wedding\.png/s)
  fs.writeFileSync(sessionFile(), saved)
  assert.doesNotMatch((await req('/who/O1')).body, /class=warn/)
})

test('a save must be JSON, from this machine, for a known photo', async () => {
  const kept = fs.readFileSync(sessionFile(), 'utf8')
  const ok = { year: '', boxes: [] }
  assert.equal((await post('/who/O1', ok, { 'content-type': 'text/plain' })).status, 415)
  assert.equal((await post('/who/O1', ok, { 'content-type': 'application/json', origin: 'http://evil.example' })).status, 403)
  assert.equal((await post('/who/O1', ok, undefined, { host: 'evil.example:4000' })).status, 403, 'a rebound DNS name is refused')
  assert.equal((await req('/who', { host: 'evil.example' })).status, 403)
  assert.equal((await post('/who/O9', ok)).status, 404)
  assert.equal((await post('/who/O1', { boxes: 'x' })).status, 400)
  assert.equal((await req('/who/O1', { method: 'POST', body: '{', headers: { 'content-type': 'application/json' } })).status, 400)
  assert.equal(fs.readFileSync(sessionFile(), 'utf8'), kept)
})

test('a session file that cannot be read is reported, not overwritten', async () => {
  fs.writeFileSync(sessionFile(), '{ broken')
  const r = await req('/who/O1')
  assert.equal(r.status, 500)
  assert.match(r.body, /sessions\/O1\.json/)
  assert.equal(fs.readFileSync(sessionFile(), 'utf8'), '{ broken')
})

test('other paths still fall through to the site', async () => {
  assert.equal((await req('/whoever.html')).status, 404)
  assert.equal((await req('/I1.html', { method: 'POST' })).status, 405)
})
