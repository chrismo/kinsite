// Identify mode for the dev server (`npm run dev`, `kinsite dev`): draw boxes on a photo, say who is in each, and get OBJE/CROP/TITL lines to paste.
// Answers are saved to <config who folder>/<OBJE id>.json; the GEDCOM is only read.
import fs from 'node:fs'
import path from 'node:path'
import { loadConfig } from '../lib/config.mjs'
import { parseGedcom, restricted } from '../lib/gedcom.mjs'
import { mediaSource } from '../lib/build.mjs'
import { imageSize, cropBox } from '../lib/media.mjs'
import { IMG_EXT, life } from '../lib/render.mjs'
import { esc } from '../lib/html.mjs'
import { yr } from '../lib/dates.mjs'
import { CSS } from '../lib/css.mjs'
import { TYPES } from './serve.mjs'

export function whoPhotos({ indi, obje }) {
  const photos = new Map([...obje].filter(([, o]) => IMG_EXT.has(path.extname(o.file).toLowerCase()))
    .map(([oid, o]) => [oid, { oid, file: o.file, title: o.title, links: [] }]))
  for (const [pid, p] of indi) {
    for (const md of p.media) photos.get(md.obje)?.links.push({ pid, caption: md.caption ?? '', crop: md.crop })
  }
  return photos
}

export function peopleList(indi) {
  const lower = s => s.toLowerCase()
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
  const year = e => (restricted(e) ? null : Number(yr(e.date)) || null)
  return [...indi.values()]
    .sort((a, b) => cmp(lower(a.surn), lower(b.surn)) || cmp(lower(a.giv), lower(b.giv)) || cmp(a.id, b.id))
    .map(p => ({ id: p.id, name: p.name || '(unnamed)', life: life(p), b: year(p.birt), d: year(p.deat) }))
}

export const linkedBoxes = (photo, size) =>
  Object.fromEntries(photo.links.map(({ pid, caption, crop }) => [pid, { caption, box: (crop && cropBox(crop, size)) || null }]))

export function seedSession(photo, size) {
  const boxes = photo.links.flatMap(({ pid, caption, crop }) => {
    const box = crop && cropBox(crop, size)
    return box ? [{ ...box, who: pid, guess: false, caption, note: '' }] : []
  }).sort((a, b) => a.left - b.left || a.top - b.top)
  return { year: photo.title.match(/\b\d{4}\b/)?.[0] ?? '', file: photo.file, base: linkedBoxes(photo, size), boxes }
}

const WHO = /^(\w+|not in tree|not sure)?$/

export function cleanSession(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.boxes)) return null
  const px = n => (Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0)
  const text = (s, max) => (typeof s === 'string' ? s.slice(0, max) : '')
  const rect = b => ({ left: px(b.left), top: px(b.top), width: px(b.width), height: px(b.height) })
  const base = Object.fromEntries(Object.entries(raw.base && typeof raw.base === 'object' ? raw.base : {})
    .filter(([pid, l]) => /^\w+$/.test(pid) && l && typeof l === 'object' && typeof l.caption === 'string')
    .map(([pid, l]) => [pid, { caption: text(l.caption, 500), box: l.box && typeof l.box === 'object' ? rect(l.box) : null }]))
  const boxes = raw.boxes.filter(b => b && typeof b === 'object').slice(0, 1000).map(b => ({
    ...rect(b),
    who: typeof b.who === 'string' && WHO.test(b.who) ? b.who : '', guess: b.guess === true,
    caption: text(b.caption, 500), note: text(b.note, 5000),
  })).filter(b => b.width && b.height)
  return { year: /^\d{4}$/.test(raw.year) ? raw.year : '', file: text(raw.file, 1000), base, boxes }
}

// base is the GEDCOM's links as the session last saw them: a crop changed in the GEDCOM since then wins over the box.
export function mergeGedcom(session, now) {
  const boxes = session.boxes.map(b => ({ ...b })), updated = []
  for (const [pid, link] of Object.entries(now)) {
    const was = Object.hasOwn(session.base, pid) ? session.base[pid] : null
    if (!link.box || JSON.stringify(link) === JSON.stringify(was)) continue
    updated.push(pid)
    const b = boxes.find(x => x.who === pid)
    if (b) Object.assign(b, link.box, { caption: link.caption, guess: false })
    else boxes.push({ ...link.box, who: pid, guess: false, caption: link.caption, note: '' })
  }
  return { session: { ...session, base: now, boxes }, updated }
}

// suggest, groups and linkBlocks also run in the page, so each must stand alone.
export function suggest(people, query, year, linked, limit = 12) {
  const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const words = fold(query).split(/\s+/).filter(Boolean)
  const y = /^\d{4}$/.test(year) ? Number(year) : 0
  const alive = ({ b, d }) => {
    if (!y || !(b || d) || (b && b > y) || (d && d < y)) return false
    return d ? !!b || d - y <= 100 : y - b <= 100
  }
  const tier = p => (linked.includes(p.id) ? 'linked' : alive(p) ? 'alive' : '')
  const order = { linked: 0, alive: 1, '': 2 }
  return people
    .filter(p => words.every(w => fold(p.name).includes(w)) || fold(query.trim()) === fold(p.id))
    .map(p => ({ ...p, tier: tier(p) }))
    .map((p, i) => [p, i]).sort(([a, i], [b, j]) => order[a.tier] - order[b.tier] || i - j)
    .slice(0, limit).map(([p]) => p)
}

export function groups(boxes, linked, names) {
  const g = { placed: [], guessed: [], unknown: [], open: [], unboxed: [] }
  boxes.forEach((b, i) => {
    const kind = Object.hasOwn(names, b.who) ? (b.guess ? 'guessed' : 'placed')
      : b.who === 'not in tree' || b.who === 'not sure' ? 'unknown' : 'open'
    g[kind].push(i)
  })
  g.unboxed = linked.filter(pid => !boxes.some(b => b.who === pid))
  return g
}

export function linkBlocks(oid, boxes, linked, names) {
  const blocks = []
  let same = 0
  for (const b of boxes) {
    if (b.guess || !Object.hasOwn(names, b.who)) continue
    const caption = b.caption.replace(/\s+/g, ' ').trim()
    const was = Object.hasOwn(linked, b.who) ? linked[b.who] : null
    if (was?.box && was.caption === caption && ['left', 'top', 'width', 'height'].every(k => was.box[k] === b[k])) {
      same++
      continue
    }
    const lines = [`1 OBJE @${oid}@`, '2 CROP', `3 TOP ${b.top}`, `3 LEFT ${b.left}`, `3 HEIGHT ${b.height}`, `3 WIDTH ${b.width}`]
    if (caption) lines.push(`2 TITL ${caption.replace(/^@/, '@@')}`)
    blocks.push({ pid: b.who, name: names[b.who], status: was ? 'changed' : 'new', text: lines.join('\n') })
  }
  return { blocks, same }
}

const sessionPath = (dir, oid) => path.join(dir, `${oid}.json`)

// Throws on a file it can't use, so that file is never overwritten.
export function readSession(dir, oid) {
  let text
  try {
    text = fs.readFileSync(sessionPath(dir, oid), 'utf8')
  } catch (e) {
    if (e.code === 'ENOENT') return null
    throw e
  }
  const s = cleanSession(JSON.parse(text))
  if (!s) throw new Error('it has no "boxes" list')
  return s
}

function saveSession(dir, photo, session) {
  fs.mkdirSync(dir, { recursive: true })
  const file = sessionPath(dir, photo.oid)
  fs.writeFileSync(file + '.tmp', JSON.stringify({ obje: photo.oid, file: photo.file, ...session }, null, 2) + '\n')
  fs.renameSync(file + '.tmp', file)
}

function sizeOf(file) {
  try {
    const fd = fs.openSync(file, 'r')
    try {
      const buf = Buffer.alloc(1 << 20)
      return imageSize(buf.subarray(0, fs.readSync(fd, buf, 0, buf.length, 0)))
    } finally {
      fs.closeSync(fd)
    }
  } catch {
    return null
  }
}

const shell = (title, body, script = '') => `<!doctype html><html lang=en><head><meta charset=utf-8>` +
  `<meta name=viewport content='width=device-width,initial-scale=1'><title>${esc(title)}</title>` +
  `<style>${CSS}${WHO_CSS}</style></head><body><div class=wrap>${body}</div>${script}</body></html>`

const count = (n, one, many = one) => `${n} ${n === 1 ? one : many}`

// Without the image's size the GEDCOM crops can't be placed, and merging would forget them.
function openSession(dir, photo, size) {
  const saved = readSession(dir, photo.oid)
  if (!saved) return { session: seedSession(photo, size), saved: false, updated: [], movedFrom: '' }
  const movedFrom = saved.file && saved.file !== photo.file ? saved.file : ''
  if (movedFrom || !size) return { session: saved, saved: true, updated: [], movedFrom }
  return { ...mergeGedcom(saved, linkedBoxes(photo, size)), saved: true, movedFrom }
}

function indexPage(photos, people, { dir, mediaRoot, shown, folder }) {
  const names = Object.fromEntries(people.map(p => [p.id, p.name]))
  const rows = [...photos.values()].map(photo => {
    const href = `/who/${photo.oid}`, size = sizeOf(mediaSource(photo.file, mediaRoot))
    let state = '', session
    try {
      const s = openSession(dir, photo, size)
      session = s.session
      if (s.saved) state = s.movedFrom ? ` · <b>saved for ${esc(s.movedFrom)}</b>` : ' · saved'
    } catch {
      session = seedSession(photo, size)
      state = ` · <b>${esc(shown(photo.oid))} can't be read</b>`
    }
    const g = groups(session.boxes, photo.links.map(l => l.pid), names)
    const counts = [count(photo.links.length, 'linked'), count(g.placed.length, 'placed'),
      g.guessed.length && count(g.guessed.length, 'guessed'), g.unknown.length && count(g.unknown.length, 'unknown'),
      count(g.open.length + g.unboxed.length, 'to place')].filter(Boolean).join(' · ')
    return `<li><a href="${href}"><img src="${href}/image" alt="" loading=lazy></a><div><a href="${href}">${esc(photo.title || path.basename(photo.file))}</a>` +
      ` <span class=yr>${esc(photo.oid)}</span><div class=cnt>${counts}${state}</div></div></li>`
  })
  return shell('Photos to identify', '<p class=back><a href="/">&larr; Site</a></p><h1>Photos to identify</h1>' +
    `<p class=sub>Draw a box around each person and say who it is. Answers are saved in <code>${esc(folder)}/</code>; ` +
    'the GEDCOM is never changed.</p>' +
    (rows.length ? `<ul class=whos>${rows.join('')}</ul>` : '<p>No image <code>OBJE</code> records in the GEDCOM.</p>'))
}

function photoPage(photo, data, notices) {
  const t = photo.title || path.basename(photo.file), src = `/who/${photo.oid}/image`
  const body = `<p class=back><a href="/who">&larr; All photos</a></p><h1>${esc(t)}</h1>` +
    `<p class=sub>${esc(photo.oid)} &middot; ${esc(photo.file)} &middot; <label>Taken about <input id=year inputmode=numeric maxlength=4 size=4 placeholder=year></label>` +
    ` &middot; <span id=status></span></p>${notices}` +
    '<p class=hint>Drag on the photo to draw a box around someone. Drag a box to move it, or its corner to resize it.</p>' +
    `<div class=who-grid><div id=stage class=stage><img id=photo src="${src}" alt="${esc(t)}" draggable=false></div>` +
    '<aside id=panel><p id=empty class=sub>Draw a box, or pick one, to say who it is.</p><div id=editor hidden>' +
    `<h2>Box <span id=num></span></h2><div id=zoom><img src="${src}" alt=""></div><p id=answer></p>` +
    '<label for=find>Who is this?</label><input id=find type=search autocomplete=off placeholder="Search by name or ID"><ul id=hits></ul>' +
    '<label class=check><input type=checkbox id=guess> This is a guess</label>' +
    '<label for=caption>Caption for their link (<code>TITL</code>)</label><input id=caption type=text>' +
    '<label for=note>Notes (kept in the session file only)</label><textarea id=note></textarea>' +
    '<p><button type=button id=del>Delete box</button></p></div></aside></div>' +
    '<h2>In this photo</h2><div id=lists></div><h2>For your GEDCOM</h2><div id=paste></div>'
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  return shell(`Identify: ${t}`, body, `<script>const DATA = ${json};\n(${client})(DATA, ${suggest}, ${groups}, ${linkBlocks})</script>`)
}

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/
const LOCAL_ADDR = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

export function whoHandler(configFile) {
  const home = path.dirname(path.resolve(configFile))
  return (req, res) => {
    const url = req.url.split('?')[0]
    if (url !== '/who' && !url.startsWith('/who/')) return false
    const send = (status, body, type = 'text/plain; charset=utf-8') => {
      res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
      res.end(body)
    }
    try {
      route(req, url, send)
    } catch (e) {
      send(500, `error: ${e.message}`)
    }
    return true
  }

  function route(req, url, send) {
    // The whole tree, living people included, and a file write: only for this machine, not the network or a rebound DNS name.
    if (!LOCAL_ADDR.has(req.socket.remoteAddress) || !LOCAL_HOST.test(req.headers.host ?? '')) {
      return send(403, `Identify mode answers only on this machine: http://localhost:${req.socket.localPort}/who`)
    }
    const m = url.match(/^\/who(?:\/(\w+)(\/image)?)?\/?$/)
    if (!m) return send(404, 'not found')
    const [, oid, image] = m
    const config = loadConfig(configFile), dir = config.who
    const shown = oid => path.relative(home, sessionPath(dir, oid))
    const parsed = parseGedcom(fs.readFileSync(config.gedcom, 'utf8'))
    const photos = whoPhotos(parsed), people = peopleList(parsed.indi)
    const photo = oid && photos.get(oid)
    if (oid && !photo) return send(404, 'not found')
    if (req.method === 'POST' && photo && !image) return save(req, send, dir, photo)
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, 'method not allowed')
    if (!photo) return send(200, indexPage(photos, people, { dir, mediaRoot: config.mediaRoot, shown, folder: path.relative(home, dir) }), TYPES['.html'])
    const file = mediaSource(photo.file, config.mediaRoot)
    if (image) {
      if (!fs.statSync(file, { throwIfNoEntry: false })?.isFile()) return send(404, 'not found')
      return send(200, fs.readFileSync(file), TYPES[path.extname(file).toLowerCase()])
    }
    const size = sizeOf(file)
    let s
    try {
      s = openSession(dir, photo, size)
    } catch (e) {
      return send(500, `${shown(oid)} can't be read (${e.message}). Fix or move it; identify mode won't overwrite it.`)
    }
    const names = Object.fromEntries(people.map(p => [p.id, p.name]))
    const notices = (s.movedFrom ? `<p class=warn>This session was saved for <code>${esc(s.movedFrom)}</code>, but ${esc(oid)} is now ` +
      `<code>${esc(photo.file)}</code>. If the GEDCOM's IDs were renumbered, these boxes may belong to another photo: ` +
      `move <code>${esc(shown(oid))}</code> aside before changing anything.</p>` : '') +
      (s.updated.length ? `<p class=merged>Updated from the GEDCOM since this session was saved: ${esc(s.updated.map(pid => names[pid]).join(', '))}.</p>` : '')
    send(200, photoPage(photo, {
      oid, size, saved: s.saved, session: s.session, people, sessionFile: shown(oid),
      linkedIds: photo.links.map(l => l.pid), linked: linkedBoxes(photo, size),
    }, notices), TYPES['.html'])
  }

  function save(req, send, dir, photo) {
    // A JSON body makes a cross-site request preflight, which this server never grants.
    if (!/^application\/json\b/.test(req.headers['content-type'] ?? '')) return send(415, 'send JSON')
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return send(403, 'forbidden')
    const chunks = []
    let size = 0
    req.on('data', c => {
      size += c.length
      if (size > 2 << 20) {
        send(413, 'too large')
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => {
      let session
      try {
        session = cleanSession(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {}
      if (!session) return send(400, 'not a session')
      try {
        saveSession(dir, photo, session)
        send(204, '')
      } catch (e) {
        send(500, `error: ${e.message}`)
      }
    })
  }
}

function client(D, suggest, groups, linkBlocks) {
  const $ = id => document.getElementById(id)
  const stage = $('stage'), img = $('photo'), find = $('find'), hits = $('hits')
  const names = Object.fromEntries(D.people.map(p => [p.id, p.name]))
  const lives = Object.fromEntries(D.people.map(p => [p.id, p.life]))
  const isPerson = who => Object.hasOwn(names, who)
  const S = D.session, boxes = S.boxes
  let size = D.size, sel = -1, drag = null, timer = null, undo = null
  const h = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)
  const pct = (n, of) => `${(n / of) * 100}%`
  const label = who => (isPerson(who) ? names[who] : who === 'not in tree' ? 'Someone not in the tree' : who === 'not sure' ? 'Not sure' : 'No answer yet')
  const setValue = (el, v) => { if (el.value !== v) el.value = v }

  function status(text) {
    $('status').innerHTML = h(text) + (undo ? ` <button type=button id=undo>Undo</button>` : '')
  }

  function drawBoxes() {
    stage.querySelectorAll('.box').forEach(e => e.remove())
    if (!size) return
    const g = groups(boxes, D.linkedIds, names), kind = {}
    for (const k of ['placed', 'guessed', 'unknown', 'open']) for (const i of g[k]) kind[i] = k
    boxes.forEach((b, i) => {
      const e = document.createElement('div')
      e.className = `box ${kind[i]}${i === sel ? ' sel' : ''}`
      e.dataset.i = i
      e.title = label(b.who)
      Object.assign(e.style, { left: pct(b.left, size.width), top: pct(b.top, size.height), width: pct(b.width, size.width), height: pct(b.height, size.height) })
      e.innerHTML = `<b>${i + 1}</b>${i === sel ? '<i class=handle></i>' : ''}`
      stage.append(e)
    })
  }

  function zoom(b) {
    const z = $('zoom')
    z.style.aspectRatio = `${b.width} / ${b.height}`
    z.style.width = `min(100%, ${Math.round((280 * b.width) / b.height)}px)`
    Object.assign(z.firstChild.style, { width: pct(size.width, b.width), left: pct(-b.left, b.width), top: pct(-b.top, b.height) })
  }

  function showHits() {
    const b = boxes[sel], inBox = new Map(boxes.map((x, i) => [x.who, i]))
    const why = { linked: 'linked to this photo', alive: `alive in ${S.year}` }
    const free = p => !inBox.has(p.id) || inBox.get(p.id) === sel
    const found = suggest(D.people, find.value, S.year, D.linkedIds, 50)
    hits.innerHTML = [...found.filter(free), ...found.filter(p => !free(p))].slice(0, 12).map(p =>
      `<li><button type=button data-who="${h(p.id)}"${p.id === b.who ? ' class=on' : ''}>${h(p.name)}` +
      (p.life ? ` <span class=yr>${h(p.life)}</span>` : '') + (p.tier ? ` <small>${why[p.tier]}</small>` : '') +
      (inBox.has(p.id) && inBox.get(p.id) !== sel ? ` <small>in box ${inBox.get(p.id) + 1}</small>` : '') + '</button></li>').join('') +
      ['not in tree', 'not sure'].map(w => `<li><button type=button data-who="${w}" class="alt${b.who === w ? ' on' : ''}">${label(w)}</button></li>`).join('')
  }

  function showPanel() {
    const b = boxes[sel]
    $('editor').hidden = !b
    $('empty').hidden = !!b
    if (!b) return
    $('num').textContent = sel + 1
    $('answer').innerHTML = isPerson(b.who)
      ? `<a href="/${h(b.who)}.html" target=_blank>${h(names[b.who])}</a>${lives[b.who] ? ` <span class=yr>(${h(lives[b.who])})</span>` : ''}`
      : `<span class=unknown>${h(label(b.who))}</span>`
    $('guess').checked = b.guess
    $('guess').disabled = !isPerson(b.who)
    setValue($('caption'), b.caption)
    setValue($('note'), b.note)
    zoom(b)
    showHits()
  }

  function showLists() {
    const g = groups(boxes, D.linkedIds, names)
    const item = i => {
      const b = boxes[i]
      return `<li><button type=button class=pick data-i=${i}>Box ${i + 1}</button> ${h(label(b.who))}` +
        (b.caption ? ` <span class=cn>${h(b.caption)}</span>` : '') + (b.note ? ` <span class=yr>&mdash; ${h(b.note)}</span>` : '') + '</li>'
    }
    const part = (title, items) => (items.length ? `<h3>${title} (${items.length})</h3><ul class=rel>${items.join('')}</ul>` : '')
    $('lists').innerHTML = part('Placed', g.placed.map(item)) + part('Guessed', g.guessed.map(item)) + part('Unknown', g.unknown.map(item)) +
      part('To place', [...g.open.map(item), ...g.unboxed.map(pid => `<li>${h(names[pid])} <span class=yr>linked, no box yet</span></li>`)]) ||
      '<p class=sub>No boxes yet.</p>'
  }

  let blocks = []
  function showPaste() {
    const out = linkBlocks(D.oid, boxes, D.linked, names)
    blocks = out.blocks
    const what = { new: 'add this link', changed: `replace their link to @${D.oid}@ with this` }
    const same = out.same ? `${out.same} placed ${out.same === 1 ? 'person already matches' : 'people already match'} the GEDCOM. ` : ''
    $('paste').innerHTML = blocks.map((k, n) =>
      `<div class=block><p><b>${h(k.name)}</b> <span class=yr>under <code>0 @${h(k.pid)}@ INDI</code>, ${what[k.status]}</span> ` +
      `<button type=button class=copy data-n=${n}>Copy</button></p><pre>${h(k.text)}</pre></div>`).join('') +
      `<p class=sub>${blocks.length ? '' : 'Nothing new to paste. '}${same}Guesses, unknowns and notes stay in <code>${h(D.sessionFile)}</code>.</p>`
  }

  function render() {
    drawBoxes()
    showPanel()
    showLists()
    showPaste()
  }

  async function save(keepalive = false) {
    clearTimeout(timer)
    timer = null
    try {
      const r = await fetch(location.pathname, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(S), keepalive })
      status(r.ok ? 'Saved' : `Not saved: ${await r.text()}`)
    } catch {
      status('Not saved: is npm run dev still running?')
    }
  }

  function changed(keepUndo = false) {
    if (!keepUndo) undo = null
    render()
    status('Saving…')
    clearTimeout(timer)
    timer = setTimeout(save, 400)
  }

  function select(i) {
    sel = i
    find.value = ''
    render()
    if (i >= 0) find.focus({ preventScroll: true })
  }

  const point = e => {
    const r = img.getBoundingClientRect(), clamp = v => Math.min(Math.max(v, 0), 1)
    return { x: clamp((e.clientX - r.left) / r.width) * size.width, y: clamp((e.clientY - r.top) / r.height) * size.height }
  }
  const span = (x0, y0, x1, y1) => ({
    left: Math.round(Math.min(x0, x1)), top: Math.round(Math.min(y0, y1)),
    width: Math.max(1, Math.round(Math.abs(x1 - x0))), height: Math.max(1, Math.round(Math.abs(y1 - y0))),
  })

  stage.addEventListener('pointerdown', e => {
    if (!size || e.button !== 0) return
    const p = point(e), el = e.target.closest('.box'), i = el ? +el.dataset.i : -1
    if (e.target.classList.contains('handle')) drag = { mode: 'size', i, x0: boxes[i].left, y0: boxes[i].top }
    else if (el) drag = { mode: 'move', i, dx: p.x - boxes[i].left, dy: p.y - boxes[i].top }
    else drag = { mode: 'draw', i: -1, x0: p.x, y0: p.y }
    if (el) sel = i
    stage.setPointerCapture(e.pointerId)
    e.preventDefault()
    drawBoxes()
  })
  stage.addEventListener('pointermove', e => {
    if (!drag) return
    const p = point(e), b = boxes[drag.i]
    if (drag.mode === 'move') {
      b.left = Math.round(Math.min(Math.max(p.x - drag.dx, 0), size.width - b.width))
      b.top = Math.round(Math.min(Math.max(p.y - drag.dy, 0), size.height - b.height))
    } else if (b) Object.assign(b, span(drag.x0, drag.y0, p.x, p.y))
    else if (Math.hypot(p.x - drag.x0, p.y - drag.y0) > (8 * size.width) / img.getBoundingClientRect().width) {
      boxes.push({ ...span(drag.x0, drag.y0, p.x, p.y), who: '', guess: false, caption: '', note: '' })
      drag.i = sel = boxes.length - 1
    } else return
    drag.moved = true
    drawBoxes()
    if (boxes[sel]) zoom(boxes[sel])
  })
  const end = () => {
    if (!drag) return
    const { moved, i } = drag
    drag = null
    select(i)
    if (moved) changed()
  }
  stage.addEventListener('pointerup', end)
  stage.addEventListener('pointercancel', end)

  hits.addEventListener('click', e => {
    const btn = e.target.closest('button')
    if (!btn) return
    const b = boxes[sel]
    b.who = btn.dataset.who
    if (!isPerson(b.who)) b.guess = false
    find.value = ''
    changed()
  })
  find.addEventListener('input', showHits)
  find.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    hits.querySelector('button')?.click()
  })
  $('guess').addEventListener('change', e => { boxes[sel].guess = e.target.checked; changed() })
  $('caption').addEventListener('input', e => { boxes[sel].caption = e.target.value; changed() })
  $('note').addEventListener('input', e => { boxes[sel].note = e.target.value; changed() })
  $('year').value = S.year
  $('year').addEventListener('input', e => {
    const v = e.target.value.trim()
    S.year = /^\d{4}$/.test(v) ? v : ''
    changed()
  })
  $('del').addEventListener('click', () => {
    undo = { i: sel, box: boxes.splice(sel, 1)[0] }
    sel = -1
    changed(true)
  })
  $('status').addEventListener('click', e => {
    if (e.target.id !== 'undo') return
    boxes.splice(undo.i, 0, undo.box)
    sel = undo.i
    undo = null
    changed()
  })
  $('lists').addEventListener('click', e => {
    const b = e.target.closest('.pick')
    if (b) select(+b.dataset.i)
  })
  $('paste').addEventListener('click', e => {
    const b = e.target.closest('.copy')
    if (!b) return
    navigator.clipboard.writeText(blocks[+b.dataset.n].text).then(() => { b.textContent = 'Copied' })
  })
  addEventListener('beforeunload', () => { if (timer) save(true) })
  addEventListener('keydown', e => { if (e.key === 'Escape' && sel >= 0) select(-1) })

  const start = () => {
    size ||= { width: img.naturalWidth, height: img.naturalHeight }
    render()
  }
  status(D.saved ? 'Saved' : 'Starting from the GEDCOM; changes save as you go')
  if (size) render()
  else if (img.complete && img.naturalWidth) start()
  else img.addEventListener('load', start)
}

const WHO_CSS = `
.wrap{max-width:1180px}
.hint{color:var(--mut);font-size:.9em;margin:0 0 .6em}
.warn,.merged{border-radius:8px;padding:8px 12px;margin:.6em 0}
.warn{background:#fff4d6;border:1px solid #e8c96a}
.merged{background:#eef4ea;border:1px solid #c9dbbf}
.sub input{width:4.2em;font:inherit;padding:1px 4px;border:1px solid var(--line);border-radius:4px}
#status button{font:inherit;font-size:.9em;padding:0 6px}
.who-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:20px;align-items:start}
@media(max-width:860px){.who-grid{grid-template-columns:minmax(0,1fr)}}
#stage{margin:0;touch-action:none;user-select:none;-webkit-user-select:none;cursor:crosshair}
#stage img{pointer-events:none}
.box{position:absolute;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.6);cursor:move}
.box b{position:absolute;left:0;top:0;min-width:1.5em;padding:0 .25em;font-size:12px;line-height:1.5em;
 text-align:center;color:#fff;background:rgba(0,0,0,.6);border-radius:0 0 3px 0;pointer-events:none}
.box.guessed{border-style:dashed}
.box.unknown{border-color:#f3c86b}
.box.open{border-style:dotted}
.box.sel{border-color:var(--accent);box-shadow:0 0 0 2px #fff,0 0 0 3px rgba(0,0,0,.5)}
.handle{position:absolute;right:-8px;bottom:-8px;width:16px;height:16px;background:#fff;border:2px solid var(--accent);
 border-radius:3px;cursor:nwse-resize}
#panel{position:sticky;top:12px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:4px 16px 12px}
#panel h2{margin-top:.8em}
#zoom{position:relative;overflow:hidden;border-radius:6px;background:#eee;margin:.4em 0}
#zoom img{position:absolute;max-width:none}
#answer{margin:.3em 0;font-weight:600}
#panel label{display:block;font-size:.85em;color:var(--mut);margin:.7em 0 .2em}
#panel label.check{color:var(--ink)}
#panel input[type=search],#panel input[type=text],#panel textarea{width:100%;padding:7px 9px;font:inherit;
 border:1px solid var(--line);border-radius:6px}
#panel textarea{min-height:5em;resize:vertical}
#hits{list-style:none;margin:.3em 0;padding:0;max-height:280px;overflow:auto}
#hits button{display:block;width:100%;text-align:left;padding:4px 8px;border:0;background:none;font:inherit;
 color:var(--ink);border-radius:5px;cursor:pointer}
#hits button:hover,#hits button:focus{background:#f3ece0}
#hits button.on{background:#efe3d2;font-weight:600}
#hits button.alt{color:var(--mut);font-style:italic}
#hits small{color:var(--accent);font-size:.75em;margin-left:.3em}
#lists h3{font-size:.9em;margin:.8em 0 .3em}
#lists .pick{font:inherit;font-size:.85em;padding:0 6px}
.block p{margin:.6em 0 .2em}
.block pre{background:#fff;border:1px solid var(--line);border-radius:6px;padding:8px 10px;overflow-x:auto;margin:0}
ul.whos{list-style:none;padding:0;margin:0}
ul.whos li{display:flex;gap:14px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line)}
ul.whos img{width:120px;height:80px;object-fit:cover;border-radius:6px;border:1px solid var(--line);display:block}
ul.whos .cnt{color:var(--mut);font-size:.9em}
`
