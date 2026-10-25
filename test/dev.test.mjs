import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { createServer, RELOAD_SCRIPT } from '../scripts/serve.mjs'

let root, server, state

function get(p) {
  return new Promise((resolve, reject) => {
    // raw request so the client does not normalize ".." away
    http.get({ host: '127.0.0.1', port: server.address().port, path: p }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], body: Buffer.concat(chunks).toString() }))
    }).on('error', reject)
  })
}

before(async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'kinsite-dev-'))
  root = path.join(parent, 'site')
  fs.mkdirSync(root)
  fs.writeFileSync(path.join(parent, 'secret.txt'), 'secret')
  fs.writeFileSync(path.join(root, 'index.html'), '<html><body>home</body></html>')
  for (const f of ['style.css', 'a.svg', 'p.png', 'p.jpg', 'x.unknown']) fs.writeFileSync(path.join(root, f), 'x')
  state = { version: 1 }
  server = createServer(() => root, state)
  await new Promise(r => server.listen(0, '127.0.0.1', r))
})

after(() => {
  server.close()
  fs.rmSync(path.dirname(root), { recursive: true })
})

test('/ serves index.html with the reload script injected', async () => {
  const r = await get('/')
  assert.equal(r.status, 200)
  assert.match(r.type, /^text\/html/)
  assert.ok(r.body.includes(RELOAD_SCRIPT))
  assert.ok(r.body.indexOf(RELOAD_SCRIPT) < r.body.indexOf('</body>'))
})

test('the file on disk is never modified', () => {
  assert.equal(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), '<html><body>home</body></html>')
})

test('content types by extension', async () => {
  for (const [p, type] of [['/style.css', 'text/css'], ['/a.svg', 'image/svg+xml'], ['/p.png', 'image/png'], ['/p.jpg', 'image/jpeg'], ['/x.unknown', 'application/octet-stream']]) {
    const r = await get(p)
    assert.equal(r.status, 200, p)
    assert.ok(r.type.startsWith(type), p)
    assert.ok(!r.body.includes(RELOAD_SCRIPT), p)
  }
})

test('missing file is 404', async () => {
  assert.equal((await get('/nope.html')).status, 404)
})

test('traversal outside the output dir is rejected', async () => {
  for (const p of ['/../secret.txt', '/%2e%2e/secret.txt', '/..%2fsecret.txt', '/a/../../secret.txt', '/%00']) {
    const r = await get(p)
    assert.ok([400, 403, 404].includes(r.status), `${p} -> ${r.status}`)
    assert.ok(!r.body.includes('secret'), p)
  }
})

test('/__version reports the build version', async () => {
  assert.equal((await get('/__version')).body, '1')
  state.version = 2
  assert.equal((await get('/__version')).body, '2')
})
