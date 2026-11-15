// What's new: the owner's narrative entries, and the change records stamped at each deploy.
import fs from 'node:fs'
import path from 'node:path'
import { restricted } from './gedcom.mjs'
import { diffTrees, describe, readGedcom } from './diff.mjs'
import { esc } from './html.mjs'
import { redact } from './redact.mjs'

export const count = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

const INLINE = /\*\*(?!\s)(.+?)(?<!\s)\*\*|\*(?!\s)(.+?)(?<!\s)\*|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/\S*[^\s.,;:!?)'"\]])|@(\w+)@/g

function inline(s, mention) {
  let html = '', at = 0
  for (const m of s.matchAll(INLINE)) {
    const [all, strong, em, text, href, url, xref] = m
    html += esc(s.slice(at, m.index))
    at = m.index + all.length
    if (strong) html += `<strong>${inline(strong, mention)}</strong>`
    else if (em) html += `<em>${inline(em, mention)}</em>`
    else if (href) html += `<a href="${esc(href)}">${esc(text)}</a>`
    else if (url) html += `<a href="${esc(url)}">${esc(url)}</a>`
    else html += mention(xref) ?? esc(all)
  }
  return html + esc(s.slice(at))
}

// The documented subset: a `# Title` first line, paragraphs, *em*, **strong**, http(s) links and @xref@ mentions.
// mention(id) returns the HTML for a person, or null to leave the mention as written.
export function markdown(text, mention) {
  const lines = redact(text).replace(/\r\n?/g, '\n').split('\n')
  const title = lines[0].match(/^# (.+)/)?.[1].trim()
  const paras = (title ? lines.slice(1) : lines).join('\n').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
  return { title: title ? inline(title, mention) : '', html: paras.map(p => `<p>${inline(p, mention)}</p>`).join('') }
}

const STAMP = /^(\d{4}-\d{2}-\d{2})(?:-(\d+))?\.changes\.json$/

export function readNews(dir) {
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).sort() : []
  const entries = new Map(files.filter(f => f.endsWith('.md')).map(f => [f.slice(0, -3), fs.readFileSync(path.join(dir, f), 'utf8')]))
  const order = f => {
    const [, date, n = '1'] = f.match(STAMP)
    return `${date} ${n.padStart(6, '0')}`
  }
  const deploys = files.filter(f => STAMP.test(f)).map(file => {
    try {
      return { entries: [], changes: [], ...JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')), file }
    } catch (e) {
      throw new Error(`${path.join(dir, file)}: ${e.message}`)
    }
  }).sort((a, b) => order(b.file).localeCompare(order(a.file)))
  const stamped = new Set(deploys.flatMap(d => d.entries))
  return { entries, deploys, pending: [...entries.keys()].filter(e => !stamped.has(e)) }
}

const localDate = d => [d.getFullYear(), d.getMonth() + 1, d.getDate()].map(n => String(n).padStart(2, '0')).join('-')

export function stampNews(config, oldFile, { today = new Date(), log = console.log } = {}) {
  if (!config.news) throw new Error('the config has no "news" directory to stamp')
  const changes = diffTrees(readGedcom(oldFile), readGedcom(config.gedcom))
  const { pending: entries } = readNews(config.news)
  if (!changes.length && !entries.length) {
    log('Nothing to stamp: no changes and no new entries.')
    return null
  }
  const date = localDate(today)
  fs.mkdirSync(config.news, { recursive: true })
  let file = path.join(config.news, `${date}.changes.json`)
  for (let n = 2; fs.existsSync(file); n++) file = path.join(config.news, `${date}-${n}.changes.json`)
  fs.writeFileSync(file, JSON.stringify({ date, entries, changes }, null, 2) + '\n')
  log(`Wrote ${path.relative(process.cwd(), file)}: ${count(entries.length, 'entry', 'entries')}, ${count(changes.length, 'change')}`)
  return file
}

// A fact restricted in today's GEDCOM drops out of past entries, so drop any record that names it.
const FACT = ['tag', 'type', 'val', 'date', 'phrase', 'plac']
const sameFact = (a, b) => FACT.every(k => (a[k] ?? '') === (b[k] ?? ''))
function unrestricted(records, tree) {
  const versions = r => (r.kind === 'marriage' ? [{ tag: 'MARR', ...tree.fam.get(r.fam)?.marr }] : tree.indi.get(r.id)?.events ?? [])
  return records.filter(r => {
    const hidden = versions(r).filter(restricted)
    return ![r.event, ...(['event', 'preferred', 'marriage'].includes(r.kind) ? [r.from, r.to, r.marr] : [])]
      .some(f => f && hidden.some(v => sameFact(v, f)))
  })
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const longDate = d => {
  const [y, m, day] = (d ?? '').split('-').map(Number)
  return MONTHS[m - 1] && day ? `${day} ${MONTHS[m - 1]} ${y}` : d ?? ''
}

// r renders the built (possibly anonymized) tree; tree is the parsed GEDCOM the records are described against.
export function whatsNewPage(news, r, tree, config, warn) {
  const mention = file => id => {
    const p = r.indi.get(id)
    if (!p) {
      warn(`news ${file}: @${id}@ is not in the tree`)
      return null
    }
    return p.private ? 'Private' : `<a href="${id}.html">${esc(p.name || '(unnamed)')}</a>`
  }
  // People removed since keep the snapshot their removal recorded, so older records can still name them.
  const snapshots = news.deploys.flatMap(d => d.changes).filter(c => c.kind === 'person' && c.op === 'removed').map(c => [c.id, c.was])
  const past = { indi: new Map([...tree.indi, ...snapshots.filter(([id]) => !tree.indi.has(id))]), fam: tree.fam }
  const linked = i => {
    const p = r.indi.get(i.id), label = p && !p.private ? redact(`${p.name || '(unnamed)'} (${i.id})`) : null
    const at = label ? i.text.indexOf(label) : -1
    if (at < 0) return esc(i.text)
    return esc(i.text.slice(0, at)) + `<a href="${i.id}.html">${esc(label)}</a>` + esc(i.text.slice(at + label.length))
  }
  const sections = news.deploys.map(d => {
    const stories = [...d.entries].sort().flatMap(e => {
      if (!news.entries.has(e)) {
        warn(`news ${d.file}: ${e}.md not found`)
        return []
      }
      const { title, html } = markdown(news.entries.get(e), mention(`${e}.md`))
      return title || html ? [`<div class=card>${title ? `<h3>${title}</h3>` : ''}${html}</div>`] : []
    })
    const items = describe(unrestricted(d.changes, tree), past, config)
    if (!stories.length && !items.length) return ''
    const list = items.map(i => `<li>${linked(i)}` +
      (i.lines.length ? `<ul>${i.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : '') + '</li>').join('')
    return `<h2>${esc(longDate(d.date))}</h2>${stories.join('')}` + (list ? `<ul class=changes>${list}</ul>` : '')
  }).join('')
  const title = "What's new"
  return r.page(title, `<p class=back><a href="index.html">&larr; All people</a></p><h1>${esc(title)}</h1>` +
    (sections || '<p class=sub>Nothing yet.</p>'))
}
