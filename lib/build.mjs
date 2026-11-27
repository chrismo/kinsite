import fs from 'node:fs'
import path from 'node:path'
import { parseGedcom } from './gedcom.mjs'
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

  const copied = new Map()
  const isFile = f => fs.statSync(f, { throwIfNoEntry: false })?.isFile() ?? false
  for (const p of indi.values()) {
    for (const md of p.media) {
      const f = md.file
      if (!f || copied.has(f)) continue
      const src = mediaSource(f, mediaRoot)
      if (!isFile(src)) continue
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
    }
  }
  const sizes = new Map()
  for (const md of [...indi.values()].flatMap(p => p.media)) {
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
