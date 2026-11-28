// Record images (#61): photos in the strip, everything else in Records, citation scans linked from the citation.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseGedcom } from '../lib/gedcom.mjs'
import { Renderer } from '../lib/render.mjs'
import { Kin } from '../lib/kin.mjs'
import { buildSite } from '../lib/build.mjs'

const GED = `0 HEAD
1 GEDC
2 VERS 7.0
0 @I1@ INDI
1 NAME Orla /Penwick/
1 BIRT
2 DATE 1890
1 OBJE @O1@
1 OBJE @O2@
1 OBJE @O5@
2 CROP
3 TOP 10
3 LEFT 20
3 HEIGHT 30
3 WIDTH 40
1 RESI
2 DATE 1920
2 SOUR @S1@
3 PAGE Sheet 4B
3 OBJE @O3@
3 OBJE @O9@
1 CHR
2 RESN PRIVACY
2 SOUR @S1@
3 PAGE Font register
3 OBJE @O6@
1 SOUR @S1@
2 PAGE Sheet 5A
2 OBJE @O4@
2 OBJE @O7@
1 FAMS @F1@
0 @I2@ INDI
1 NAME Bram /Penwick/
1 FAMS @F1@
0 @F1@ FAM
1 HUSB @I2@
1 WIFE @I1@
1 OBJE @O8@
2 TITL On the chapel steps
0 @O1@ OBJE
1 FILE portrait.jpg
2 FORM image/jpeg
3 MEDI PHOTO
2 TITL Orla in 1910
0 @O2@ OBJE
1 FILE draft-card.jpg
2 FORM image/jpeg
3 MEDI card
2 TITL Draft card
0 @O3@ OBJE
1 FILE census-1920.jpg
2 FORM image/jpeg
3 MEDI PHOTO
2 TITL Census, 1920, sheet 4B
0 @O4@ OBJE
1 FILE census-1930.jpg
0 @O5@ OBJE
1 FILE yearbook.jpg
2 FORM image/jpeg
3 MEDI BOOK
0 @O6@ OBJE
1 FILE font-register.jpg
0 @O7@ OBJE
1 FILE census-1930-transcript.pdf
2 FORM application/pdf
0 @O8@ OBJE
1 FILE wedding.jpg
2 FORM image/jpeg
0 @O10@ OBJE
1 FILE nobody-links-me.jpg
0 @S1@ SOUR
1 TITL Census of Westmarch
0 TRLR
`

const FILES = ['portrait.jpg', 'draft-card.jpg', 'census-1920.jpg', 'census-1930.jpg', 'yearbook.jpg',
  'font-register.jpg', 'census-1930-transcript.pdf', 'wedding.jpg', 'nobody-links-me.jpg']

test('an OBJE under a citation resolves to its record, on event, person and name citations; dangling ones are dropped', () => {
  const { indi } = parseGedcom(GED)
  const p = indi.get('I1')
  const resi = p.events.find(e => e.tag === 'RESI')
  assert.deepEqual(resi.sources[0].media,
    [{ obje: 'O3', file: 'census-1920.jpg', title: 'Census, 1920, sheet 4B', form: 'image/jpeg', medi: 'PHOTO' }])
  assert.equal(resi.sources[0].page, 'Sheet 4B')
  assert.deepEqual(p.sources[0].media.map(md => md.obje), ['O4', 'O7'])
  assert.deepEqual(p.media.map(md => md.obje), ['O1', 'O2', 'O5'], 'citation images are not person media')
})

test('MEDI under FORM is kept upper-cased; a record without one has an empty medi', () => {
  const { obje } = parseGedcom(GED)
  assert.equal(obje.get('O1').medi, 'PHOTO')
  assert.equal(obje.get('O2').medi, 'CARD')
  assert.equal(obje.get('O4').medi, '')
})

test('a family keeps its OBJE links, resolved, with their own TITL', () => {
  const { fam } = parseGedcom(GED)
  assert.deepEqual(fam.get('F1').media,
    [{ obje: 'O8', file: 'wedding.jpg', title: '', form: 'image/jpeg', medi: '', caption: 'On the chapel steps' }])
})

const site = (opts = {}) => {
  const { indi, fam } = parseGedcom(GED)
  const copied = new Map(FILES.map(f => [f, `media/${f}`]))
  return new Renderer({ indi, fam, kin: new Kin(indi, fam, 'I1'), copied, sizes: new Map([['yearbook.jpg', { width: 100, height: 100 }]]), ...opts })
}
const section = (html, h2) => html.split(`<h2>${h2}</h2>`)[1]?.split('<h2>')[0] ?? ''
const strip = html => html.match(/<div class="photos">.*?(?=<div class=card>|<h2>)/s)?.[0] ?? ''
const imgs = html => [...html.matchAll(/<img src="media\/([^"]+)"/g)].map(m => m[1])

test('the photo strip shows photos; other MEDI types and cited images go in Records, after the events', () => {
  const { html } = site().personPage('I1')
  assert.deepEqual(imgs(strip(html)), ['portrait.jpg', 'yearbook.jpg', 'wedding.jpg'],
    'PHOTO, a CROP of a BOOK page, and an untyped family image are photos')
  const records = section(html, 'Records')
  assert.deepEqual(imgs(records), ['draft-card.jpg', 'census-1920.jpg', 'census-1930.jpg'])
  assert.match(records, /^<div class="photos records">/)
  assert.ok(html.indexOf('<div class=card>') < html.indexOf('<h2>Records</h2>'))
})

test('an image a citation links is a record even where a person links it as a PHOTO', () => {
  const { indi, fam } = parseGedcom(GED.replace('1 OBJE @O1@\n', '1 OBJE @O1@\n1 OBJE @O3@\n'))
  const copied = new Map(FILES.map(f => [f, `media/${f}`]))
  const { html } = new Renderer({ indi, fam, kin: new Kin(indi, fam, 'I1'), copied }).personPage('I1')
  assert.ok(!imgs(strip(html)).includes('census-1920.jpg'))
  assert.deepEqual(imgs(section(html, 'Records')).filter(f => f === 'census-1920.jpg'), ['census-1920.jpg'], 'shown once')
})

test('a citation with images ends in scan links that open the dialog, titled by the image; other files link by type', () => {
  const { html } = site().personPage('I1')
  assert.match(html, /Census of Westmarch, Sheet 4B <span class=scans><a class="scan zoom" href="media\/census-1920.jpg" title="Census, 1920, sheet 4B">scan<\/a><\/span>/)
  assert.match(html, /Census of Westmarch, Sheet 5A <span class=scans><a class="scan zoom" href="media\/census-1930.jpg" title="Census of Westmarch">scan<\/a> · <a class=scan href="media\/census-1930-transcript.pdf">PDF<\/a><\/span>/)
  assert.match(html, /<dialog id=zoom/)
})

test('several scans on one citation are numbered', () => {
  const ged = GED.replace('3 OBJE @O9@\n', '3 OBJE @O4@\n')
  const { indi, fam } = parseGedcom(ged)
  const copied = new Map(FILES.map(f => [f, `media/${f}`]))
  const { html } = new Renderer({ indi, fam, kin: new Kin(indi, fam, 'I1'), copied }).personPage('I1')
  assert.match(html, /Sheet 4B <span class=scans>scans <a class="scan zoom" href="media\/census-1920.jpg" title="Census, 1920, sheet 4B">1<\/a> · <a class="scan zoom" href="media\/census-1930.jpg" title="Census of Westmarch">2<\/a><\/span>/)
})

test('a citation with only a scan still shows', () => {
  const { indi, fam } = parseGedcom(GED.replace('3 PAGE Sheet 4B\n', '').replace('1 TITL Census of Westmarch\n', ''))
  const copied = new Map(FILES.map(f => [f, `media/${f}`]))
  const { html } = new Renderer({ indi, fam, kin: new Kin(indi, fam, 'I1'), copied }).personPage('I1')
  assert.match(html, /<span class=cn>\[1\]<\/span> <span class=scans><a class="scan zoom" href="media\/census-1920.jpg"/)
})

test('scans from a restricted event, or with citations off, are not shown anywhere', () => {
  const { html } = site().personPage('I1')
  assert.doesNotMatch(html, /font-register/)
  const off = site({ citations: false }).personPage('I1').html
  assert.doesNotMatch(off, /census-19[23]0|class=scans/)
  assert.deepEqual(imgs(section(off, 'Records')), ['draft-card.jpg'])
})

test('a family image shows on both partners\' pages', () => {
  const r = site()
  for (const pid of ['I1', 'I2']) assert.match(r.personPage(pid).html, /<img src="media\/wedding.jpg" alt="On the chapel steps">/)
})

test('byte-identical files, copied once, show once on a page', () => {
  const copied = new Map(FILES.map(f => [f, `media/${f}`]))
  copied.set('census-1930.jpg', 'media/census-1920.jpg')
  const { html } = site({ copied }).personPage('I1')
  assert.deepEqual(imgs(section(html, 'Records')), ['draft-card.jpg', 'census-1920.jpg'])
})

test('a record linked twice without a crop, from the person and a family, shows once', () => {
  for (const [obje, h2] of [['O8', 'Photos'], ['O2', 'Records']]) {
    const g = GED.replace('1 FAMS @F1@\n0 @I2@', `1 FAMS @F1@\n1 OBJE @${obje}@\n0 @I2@`).replace('1 OBJE @O8@\n2 TITL On the chapel steps', `1 OBJE @${obje}@`)
    const { indi, fam } = parseGedcom(g)
    const r = new Renderer({ indi, fam, kin: new Kin(indi, fam, 'I1'), copied: new Map(FILES.map(f => [f, `media/${f}`])) })
    const all = imgs(r.personPage('I1').html)
    const file = obje === 'O8' ? 'wedding.jpg' : 'draft-card.jpg'
    assert.equal(all.filter(f => f === file).length, 1, `${obje} in ${h2}`)
  }
})

test('"with photos" counts photos only: someone with only records is not marked', () => {
  const r = site()
  assert.ok(r.personPage('I1').withPhoto)
  const { indi, fam } = parseGedcom(GED.replace(/1 OBJE @O[158]@\n(2 CROP\n(3 .*\n){4})?/g, '').replace(/1 OBJE @O8@\n2 TITL .*\n/, ''))
  const copied = new Map(FILES.map(f => [f, `media/${f}`]))
  const only = new Renderer({ indi, fam, kin: new Kin(indi, fam, 'I1'), copied })
  assert.equal(only.personPage('I1').withPhoto, false)
  assert.match(only.indexPage(), /0 with photos/)
})

test('a scan link opens the dialog captioned and described by its title', async () => {
  const html = site().personPage('I1').html
  const script = [...html.matchAll(/<script>([^]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes("'zoom'"))
  const el = (props = {}) => { const h = {}; return { h, ...props, addEventListener: (t, f) => { h[t] = f } } }
  const link = el({ title: 'Census, 1920, sheet 4B', focus() {}, getAttribute: () => 'media/census-1920.jpg', querySelector: () => null, closest: () => null })
  const parts = { img: el(), '.cap': el({ innerHTML: '', textContent: '' }), 'a.tab': el(), '.url': el({ hidden: true }), '.msg': el({ textContent: '' }), '.share': el(), '.copy': el(), '.x': el() }
  const D = el({ open: false, querySelector: s => parts[s], querySelectorAll: () => [parts['a.tab']], showModal() { this.open = true }, close() { this.open = false } })
  new Function('document', 'addEventListener', 'navigator', 'location', 'setTimeout', 'clearTimeout', script)(
    { getElementById: () => D, querySelectorAll: s => (s === 'a.zoom' ? [link] : []), querySelector: s => (s === 'h1' ? { innerHTML: 'Orla Penwick' } : null) },
    () => {}, {}, { href: 'https://kin.example/I1.html' }, () => {}, () => {})
  link.h.click({ preventDefault() {} })
  assert.ok(D.open)
  assert.equal(parts['.cap'].textContent, 'Census, 1920, sheet 4B')
  assert.equal(parts.img.alt, 'Census, 1920, sheet 4B')
  assert.equal(parts.img.src, 'https://kin.example/media/census-1920.jpg')
})

function build(extra = {}, edit = g => g) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kinsite-records-'))
  const src = path.join(dir, 'src'), out = path.join(dir, 'site')
  fs.mkdirSync(src)
  fs.writeFileSync(path.join(src, 'tree.ged'), edit(GED))
  for (const f of FILES) fs.writeFileSync(path.join(src, f), `bytes of ${f}`)
  fs.writeFileSync(path.join(src, 'census-1930.jpg'), 'bytes of census-1920.jpg')
  const log = []
  const stats = buildSite({ gedcom: path.join(src, 'tree.ged'), out, mediaRoot: src, title: 'Penwick', focus: 'I1', ...extra }, { log: s => log.push(s) })
  const files = fs.readdirSync(path.join(out, 'media')).sort()
  const page = fs.readFileSync(path.join(out, 'I1.html'), 'utf8')
  fs.rmSync(dir, { recursive: true })
  return { files, log, stats, page }
}

test('the build copies the scans it shows, a byte-identical file once, and nothing from a restricted event', () => {
  const { files, page } = build()
  assert.deepEqual(files, ['census-1920.jpg', 'census-1930-transcript.pdf', 'draft-card.jpg', 'portrait.jpg', 'wedding.jpg', 'yearbook.jpg'])
  assert.match(page, /<a class="scan zoom" href="media\/census-1920.jpg" title="Census of Westmarch">scan<\/a>/, 'the 1930 scan shares the 1920 file')
  assert.deepEqual(build({ citations: false }).files, ['draft-card.jpg', 'portrait.jpg', 'wedding.jpg', 'yearbook.jpg'])
})

test('the build warns about OBJE records no page shows, missing files apart from unlinked records, not ones hidden on purpose', () => {
  const objeLog = b => b.log.filter(s => s.includes('OBJE'))
  assert.deepEqual(objeLog(build()), ['  warning: 1 OBJE record is linked from nothing: @O10@'])
  const gone = build({}, g => g.replace('1 FILE draft-card.jpg', '1 FILE lost/draft-card.jpg'))
  assert.deepEqual(objeLog(gone), [
    '  warning: 1 OBJE record has no file to copy: @O2@ (lost/draft-card.jpg)',
    '  warning: 1 OBJE record is linked from nothing: @O10@',
  ])
  assert.deepEqual(objeLog(build({ citations: false })), ['  warning: 1 OBJE record is linked from nothing: @O10@'])
})

test('a long OBJE warning names the first ten and counts the rest', () => {
  const extra = Array.from({ length: 13 }, (_, i) => `0 @X${i + 1}@ OBJE\n1 FILE spare-${i + 1}.jpg\n`).join('')
  const [line] = build({}, g => g.replace('0 TRLR', `${extra}0 TRLR`)).log.filter(s => s.includes('OBJE'))
  assert.equal(line, '  warning: 14 OBJE records are linked from nothing: @O10@, @X1@, @X2@, @X3@, @X4@, @X5@, @X6@, @X7@, @X8@, @X9@ and 4 more')
})

test('the build summary counts people with photos, not records', () => {
  assert.equal(build().stats.withPhoto, 2)
})
