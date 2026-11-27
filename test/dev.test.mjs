import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { spawn } from 'node:child_process'
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

test('npm run dev takes a config, passes SINCE through, rebuilds the preview as entries change, and serves /who', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kinsite-dev-since-'))
  const ada = date => `0 @I1@ INDI\n1 NAME Ada /Fenwick/\n1 BIRT\n2 DATE ${date}\n2 PLAC Marrowby\n1 DEAT\n2 DATE 1920\n0 TRLR\n`
  fs.writeFileSync(path.join(dir, 'old.ged'), ada('1859'))
  fs.writeFileSync(path.join(dir, 'tree.ged'), ada('1858'))
  fs.mkdirSync(path.join(dir, 'news'))
  fs.writeFileSync(path.join(dir, 'news', 'first.md'), 'First entry.\n')
  fs.writeFileSync(path.join(dir, 'kinsite.config.json'), JSON.stringify({ gedcom: 'tree.ged', news: 'news' }))
  const dev = spawn(process.execPath, [path.join(import.meta.dirname, '../scripts/dev.mjs'), 'kinsite.config.json'], {
    cwd: dir, env: { ...process.env, INIT_CWD: dir, PORT: '0', SINCE: 'old.ged' }, stdio: ['ignore', 'pipe', 'inherit'],
  })
  try {
    const port = await new Promise((resolve, reject) => {
      let out = ''
      dev.stdout.on('data', d => {
        out += d
        const m = out.match(/http:\/\/localhost:(\d+)/)
        if (m) resolve(m[1])
      })
      dev.on('exit', code => reject(new Error(`dev exited ${code}`)))
    })
    const page = () => fetch(`http://localhost:${port}/whats-new.html`).then(r => r.text())
    const html = await page()
    assert.match(html, /Not yet published.*First entry\..*Changed birth date from 1859 to 1858/)
    fs.writeFileSync(path.join(dir, 'news', 'second.md'), 'Second entry.\n')
    for (let i = 0; i < 50 && !(await page()).includes('Second entry.'); i++) await new Promise(r => setTimeout(r, 100))
    assert.match(await page(), /Second entry\./)
    assert.match(await fetch(`http://localhost:${port}/who`).then(r => r.text()), /Photos to identify/)
  } finally {
    dev.kill()
    fs.rmSync(dir, { recursive: true })
  }
})
