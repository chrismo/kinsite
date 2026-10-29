import fs from 'node:fs'
import path from 'node:path'
import { parseGedcom } from './gedcom.mjs'
import { Kin } from './kin.mjs'
import { Renderer } from './render.mjs'
import { CSS } from './css.mjs'
import { anonymize } from './living.mjs'

export function buildSite(config, { log = console.log } = {}) {
  const { gedcom, out, mediaRoot, title, focus, anonymizeLiving, citations } = config
  if (!fs.statSync(gedcom, { throwIfNoEntry: false })?.isFile()) throw new Error(`GEDCOM not found: ${gedcom}`)
  const mediaOut = path.join(out, 'media')
  const inside = (dir, f) => {
    const rel = path.relative(dir, f)
    return !path.isAbsolute(rel) && rel.split(path.sep)[0] !== '..'
  }
  for (const keep of [gedcom, mediaRoot]) {
    if (inside(out, keep)) throw new Error(`refusing to delete ${out}: it contains ${keep}`)
  }

  log(`Building site from: ${gedcom}`)
  log(`             into : ${out}`)
  fs.rmSync(out, { recursive: true, force: true })
  fs.mkdirSync(mediaOut, { recursive: true })

  const parsed = parseGedcom(fs.readFileSync(gedcom, 'utf8'))
  const { indi, fam } = anonymizeLiving ? anonymize(parsed.indi, parsed.fam) : parsed

  const copied = new Map()
  const isFile = f => fs.statSync(f, { throwIfNoEntry: false })?.isFile() ?? false
  for (const p of indi.values()) {
    for (const md of p.media) {
      const f = md.file
      if (!f || copied.has(f)) continue
      const src = path.isAbsolute(f) && fs.existsSync(f) ? f : path.join(mediaRoot, f)
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

  fs.writeFileSync(path.join(out, 'style.css'), CSS)

  const kin = new Kin(indi, fam, focus)
  const r = new Renderer({ indi, fam, kin, copied, title, source: path.basename(gedcom), citations })
  let withPhoto = 0
  for (const pid of indi.keys()) {
    const page = r.personPage(pid)
    if (page.withPhoto) withPhoto++
    fs.writeFileSync(path.join(out, `${pid}.html`), page.html)
  }
  fs.writeFileSync(path.join(out, 'index.html'), r.indexPage())

  const stats = {
    individuals: indi.size, families: fam.size, withPhoto, media: copied.size,
    pages: fs.readdirSync(out).filter(f => f.endsWith('.html')).length,
  }
  log(`  individuals : ${stats.individuals}`)
  log(`  families    : ${stats.families}`)
  log(`  with photos : ${stats.withPhoto}`)
  log(`  media copied: ${stats.media}`)
  log(`Wrote ${stats.pages} HTML pages.`)
  log(`Open it:  open "${path.join(out, 'index.html')}"`)
  return stats
}
