import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { parseGedcom, shownCitations, allCitations } from './gedcom.mjs'
import { Kin } from './kin.mjs'
import { Renderer } from './render.mjs'
import { CSS } from './css.mjs'
import { anonymize } from './living.mjs'
import { readNews, newsSections, lastUpdated, whatsNewPage, count } from './news.mjs'
import { diffTrees, readGedcom } from './diff.mjs'
import { imageSize } from './media.mjs'

export const mediaSource = (f, mediaRoot) => (path.isAbsolute(f) && fs.existsSync(f) ? f : path.join(mediaRoot, f))

// since: an older GEDCOM to preview What's new against (the SINCE environment variable, never a config key).
export function buildSite(config, { log = console.log, since } = {}) {
  const { gedcom, out, mediaRoot, title, focus, anonymizeLiving, citations = true, notes = true } = config
  if (!fs.statSync(gedcom, { throwIfNoEntry: false })?.isFile()) throw new Error(`GEDCOM not found: ${gedcom}`)
  if (since && !config.news) throw new Error('SINCE previews the What\'s new page, so the config needs "news" set')
  const old = since && readGedcom(since)
  const mediaOut = path.join(out, 'media')
  const inside = (dir, f) => {
    const rel = path.relative(dir, f)
    return !path.isAbsolute(rel) && rel.split(path.sep)[0] !== '..'
  }
  for (const keep of [gedcom, mediaRoot, config.who].filter(Boolean)) {
    if (inside(out, keep)) throw new Error(`refusing to delete ${out}: it contains ${keep}`)
  }

  log(`Building site from: ${gedcom}`)
  log(`             into : ${out}`)
  fs.rmSync(out, { recursive: true, force: true })
  fs.mkdirSync(mediaOut, { recursive: true })

  const parsed = parseGedcom(fs.readFileSync(gedcom, 'utf8'))
  for (const w of parsed.warnings) log(`  warning: ${w}`)
  const { indi, fam } = anonymizeLiving ? anonymize(parsed.indi, parsed.fam) : parsed

  // Copy only what pages show: a copied file is public even where no page links it.
  const onPages = [
    ...[...indi.values()].flatMap(p => [...p.media, ...(citations ? shownCitations(p).flatMap(c => c.media ?? []) : [])]),
    ...[...fam.values()].flatMap(f => f.media ?? []),
  ]
  const copied = new Map(), byHash = new Map()
  const isFile = f => fs.statSync(f, { throwIfNoEntry: false })?.isFile() ?? false
  for (const md of onPages) {
    const f = md.file
    if (!f || copied.has(f)) continue
    const src = mediaSource(f, mediaRoot)
    if (!isFile(src)) continue
    const hash = crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex')
    if (byHash.has(hash)) {
      copied.set(f, byHash.get(hash))
      continue
    }
    const base = path.basename(f)
    let dst = path.join(mediaOut, base)
    for (let n = 2; fs.existsSync(dst); n++) {
      const ext = path.extname(base)
      dst = path.join(mediaOut, `${base.slice(0, base.length - ext.length)}-${n}${ext}`)
    }
    fs.copyFileSync(src, dst)
    const { atime, mtime } = fs.statSync(src)
    fs.utimesSync(dst, atime, mtime)
    copied.set(f, 'media/' + path.basename(dst))
    byHash.set(hash, copied.get(f))
  }
  const linked = new Set([
    ...[...parsed.indi.values()].flatMap(p => [...p.media, ...allCitations(p).flatMap(c => c.media ?? [])]),
    ...[...parsed.fam.values()].flatMap(f => f.media),
  ].map(md => md.obje))
  const missing = [...new Map(onPages.filter(md => !copied.has(md.file)).map(md => [md.obje, `@${md.obje}@${md.file ? ` (${md.file})` : ''}`])).values()]
  const unlinked = [...parsed.obje.keys()].filter(id => !linked.has(id)).map(id => `@${id}@`)
  const some = list => list.slice(0, 10).join(', ') + (list.length > 10 ? ` and ${list.length - 10} more` : '')
  if (missing.length) log(`  warning: ${count(missing.length, 'OBJE record')} ${missing.length === 1 ? 'has' : 'have'} no file to copy: ${some(missing)}`)
  if (unlinked.length) log(`  warning: ${count(unlinked.length, 'OBJE record')} ${unlinked.length === 1 ? 'is' : 'are'} linked from nothing: ${some(unlinked)}`)
  const sizes = new Map()
  for (const md of onPages) {
    if (md.crop && copied.has(md.file) && !sizes.has(md.file)) {
      sizes.set(md.file, imageSize(fs.readFileSync(path.join(out, copied.get(md.file)))))
    }
  }

  fs.writeFileSync(path.join(out, 'style.css'), CSS)

  const kin = new Kin(indi, fam, focus)
  const news = config.news && readNews(config.news)
  if (old) news.preview = { entries: news.pending, changes: diffTrees(old, parsed) }
  const sections = news ? newsSections(news, indi, parsed, config, w => log(`  warning: ${w}`)) : []
  const r = new Renderer({ indi, fam, kin, copied, sizes, title, source: path.basename(gedcom), citations, notes, news: !!news, updated: lastUpdated(sections) })
  let withPhoto = 0
  for (const pid of indi.keys()) {
    const page = r.personPage(pid)
    if (page.withPhoto) withPhoto++
    fs.writeFileSync(path.join(out, `${pid}.html`), page.html)
  }
  for (const oid of r.photos.keys()) fs.writeFileSync(path.join(out, `${oid}.html`), r.photoPage(oid))
  fs.writeFileSync(path.join(out, 'index.html'), r.indexPage())
  if (news) fs.writeFileSync(path.join(out, 'whats-new.html'), whatsNewPage(sections, r))

  const stats = {
    individuals: indi.size, families: fam.size, withPhoto, media: copied.size,
    pages: fs.readdirSync(out).filter(f => f.endsWith('.html')).length,
  }
  log(`  individuals : ${stats.individuals}`)
  log(`  families    : ${stats.families}`)
  log(`  with photos : ${stats.withPhoto}`)
  log(`  media copied: ${stats.media}`)
  const shown = on => (on ? 'shown' : 'hidden')
  log(`  published   : citations ${shown(citations)}, notes ${shown(notes)}, living ${anonymizeLiving ? 'anonymized' : 'shown'}`)
  if (news) log(`  news        : ${count(news.deploys.length, 'deploy')}, ${count(news.pending.length, 'entry', 'entries')} not yet stamped`)
  if (old) log(`  news        : previewing changes since ${since}`)
  log(`Wrote ${stats.pages} HTML pages.`)
  log(`Open it:  open "${path.join(out, 'index.html')}"`)
  return stats
}
